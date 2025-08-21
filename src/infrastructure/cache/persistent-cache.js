/**
 * Persistent Cache Service using better-sqlite3
 * Provides cross-platform persistent caching for GCP projects and other data
 */
import Database from 'better-sqlite3';
import xdgPkg from '@folder/xdg';
const getDataDir = () => {
  const platform = process.platform;
  if (platform === 'win32') {
    return xdgPkg.win32().data;
  } else if (platform === 'darwin') {
    return xdgPkg.darwin().data;
  } else {
    return xdgPkg.linux().data;
  }
};
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import os from 'os';
import crypto from 'crypto';

export class PersistentCache {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.cacheDir = null;
    this.dbPath = null;
    this.defaultTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  /**
   * Initialize the cache database
   */
  async init() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Get cross-platform data directory (use temp dir during tests)
      const baseDataDir =
        process.env.NODE_ENV === 'test' ? os.tmpdir() : getDataDir();
      const baseFolder =
        process.env.NODE_ENV === 'test'
          ? `plat-cli-test-${process.pid}`
          : 'plat-cli';
      this.cacheDir = join(baseDataDir, baseFolder);

      // Ensure cache directory exists
      if (!existsSync(this.cacheDir)) {
        await mkdir(this.cacheDir, { recursive: true });
      }

      // Set database path
      this.dbPath = join(this.cacheDir, 'cache.db');

      // Connect to better-sqlite3 database
      this.db = new Database(this.dbPath);

      // Enable WAL mode for better performance and concurrency
      this.db.pragma('journal_mode = WAL');

      // Initialize database schema
      this.initSchema();

      this.isInitialized = true;
      this.debugLog(`Cache initialized at: ${this.dbPath}`);
    } catch (error) {
      this.debugLog(`Failed to initialize cache: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize database schema
   */
  initSchema() {
    const queries = [
      // Projects cache table
      `CREATE TABLE IF NOT EXISTS projects_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT UNIQUE NOT NULL,
        projects TEXT NOT NULL,
        strategy TEXT NOT NULL,
        project_count INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,

      // Project history table (for autocomplete)
      `CREATE TABLE IF NOT EXISTS project_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT UNIQUE NOT NULL,
        last_used INTEGER NOT NULL,
        use_count INTEGER DEFAULT 1
      )`,

      // Instance credentials table (encrypted)
      `CREATE TABLE IF NOT EXISTS instance_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        instance TEXT NOT NULL,
        user TEXT NOT NULL,
        password TEXT,
        save_enabled INTEGER DEFAULT 1,
        last_used INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(project, instance)
      )`,

      // Session history table (for future features)
      `CREATE TABLE IF NOT EXISTS session_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_type TEXT NOT NULL,
        session_data TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,

      // Cache statistics table
      `CREATE TABLE IF NOT EXISTS cache_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        cache_key TEXT,
        hit BOOLEAN NOT NULL,
        execution_time_ms INTEGER,
        created_at INTEGER NOT NULL
      )`,

      // Indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_projects_cache_key ON projects_cache(cache_key)`,
      `CREATE INDEX IF NOT EXISTS idx_projects_expires ON projects_cache(expires_at)`,
      `CREATE INDEX IF NOT EXISTS idx_project_history_used ON project_history(last_used DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_session_history_type ON session_history(session_type, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_cache_stats_operation ON cache_stats(operation, created_at DESC)`
    ];

    // Execute schema creation queries
    for (const query of queries) {
      this.db.exec(query);
    }

    // Clean up expired entries and invalid cache on initialization
    this.cleanupExpired();
    this.cleanupInvalidCache();
  }

  /**
   * Store projects in cache
   * @param {string} cacheKey - Unique key for the cache entry
   * @param {string[]} projects - Array of project IDs
   * @param {string} strategy - Strategy used to fetch projects
   * @param {number} ttl - Time to live in milliseconds
   */
  async setProjects(
    cacheKey,
    projects,
    strategy = 'unknown',
    ttl = this.defaultTTL
  ) {
    await this.ensureInitialized();

    // Don't cache empty arrays - they're not useful
    if (!projects || projects.length === 0) {
      this.debugLog(
        `Skipping cache of empty project array for key: ${cacheKey}`
      );
      return;
    }

    const now = Date.now();
    const expiresAt = now + ttl;

    try {
      const startTime = Date.now();

      // Use better-sqlite3 API with prepared statements
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO projects_cache 
        (cache_key, projects, strategy, project_count, created_at, updated_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        cacheKey,
        JSON.stringify(projects),
        strategy,
        projects.length,
        now,
        now,
        expiresAt
      );

      // Record cache statistics
      this.recordStats('set_projects', cacheKey, false, Date.now() - startTime);

      this.debugLog(`Cached ${projects.length} projects with key: ${cacheKey}`);
    } catch (error) {
      this.debugLog(`Failed to cache projects: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get projects from cache
   * @param {string} cacheKey - Cache key to retrieve
   * @returns {Object|null} Cache data or null if not found/expired
   */
  async getProjects(cacheKey) {
    await this.ensureInitialized();

    try {
      const startTime = Date.now();

      // Use better-sqlite3 API with prepared statements
      const stmt = this.db.prepare(`
        SELECT projects, strategy, project_count, created_at, updated_at, expires_at
        FROM projects_cache 
        WHERE cache_key = ? AND expires_at > ?
      `);

      const row = stmt.get(cacheKey, Date.now());

      const executionTime = Date.now() - startTime;

      if (!row) {
        // Record cache miss
        this.recordStats('get_projects', cacheKey, false, executionTime);
        this.debugLog(`Cache miss for key: ${cacheKey}`);
        return null;
      }

      const cacheData = {
        projects: JSON.parse(row.projects),
        strategy: row.strategy,
        projectCount: row.project_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
        age: Date.now() - row.created_at
      };

      // Record cache hit
      this.recordStats('get_projects', cacheKey, true, executionTime);
      this.debugLog(
        `Cache hit for key: ${cacheKey}, ${cacheData.projects.length} projects, age: ${Math.round(cacheData.age / 1000 / 60)}m`
      );

      return cacheData;
    } catch (error) {
      this.debugLog(`Failed to get cached projects: ${error.message}`);
      return null;
    }
  }

  // Backward-compatibility helpers expected by some tests
  async get(cacheKey) {
    return this.getProjects(cacheKey);
  }

  async set(cacheKey, data, ttl = this.defaultTTL) {
    const projects = Array.isArray(data?.projects)
      ? data.projects
      : Array.isArray(data)
        ? data
        : null;
    if (!Array.isArray(projects)) {
      // Unsupported payload for legacy set(); ignore to keep backward-compat expectations
      return;
    }
    const strategy = data?.strategy || 'unknown';
    return this.setProjects(cacheKey, projects, strategy, ttl);
  }

  async clear() {
    return this.clearProjectsCache();
  }

  async getCacheAge(cacheKey) {
    const cached = await this.getProjects(cacheKey);
    return cached ? cached.age : null;
  }

  formatCacheAge(ms) {
    if (!ms || ms <= 0) return '0m';
    const minutes = Math.floor(ms / 60000);
    return `${minutes}m`;
  }

  async getProjectOperationStats() {
    // Not tracked yet; return empty object for backward compatibility
    return {};
  }

  /**
   * Add project to history for autocomplete
   * @param {string} projectId - Project ID to add to history
   */
  async addProjectToHistory(projectId) {
    await this.ensureInitialized();

    try {
      const now = Date.now();

      // Check if project already exists to get current use_count
      const existingStmt = this.db.prepare(
        `SELECT use_count FROM project_history WHERE project_id = ?`
      );
      const existing = existingStmt.get(projectId);
      const useCount = existing ? existing.use_count + 1 : 1;

      // Insert or replace with incremented use_count
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO project_history (project_id, last_used, use_count)
        VALUES (?, ?, ?)
      `);

      stmt.run(projectId, now, useCount);

      this.debugLog(`Added project to history: ${projectId}`);
    } catch (error) {
      this.debugLog(`Failed to add project to history: ${error.message}`);
    }
  }

  /**
   * Get recent projects from history
   * @param {number} limit - Maximum number of projects to return
   * @returns {string[]} Array of recent project IDs
   */
  async getRecentProjects(limit = 10) {
    await this.ensureInitialized();

    try {
      const stmt = this.db.prepare(`
        SELECT project_id FROM project_history 
        ORDER BY last_used DESC, use_count DESC 
        LIMIT ?
      `);

      const rows = stmt.all(limit);
      const projects = rows.map((row) => row.project_id);
      this.debugLog(
        `Retrieved ${projects.length} recent projects from history`
      );

      return projects;
    } catch (error) {
      this.debugLog(`Failed to get recent projects: ${error.message}`);
      return [];
    }
  }

  /**
   * Clear all project cache entries
   */
  async clearProjectsCache() {
    await this.ensureInitialized();

    try {
      const stmt = this.db.prepare('DELETE FROM projects_cache');
      stmt.run();
      this.debugLog('Cleared all project cache entries');
    } catch (error) {
      this.debugLog(`Failed to clear projects cache: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  async getCacheStats() {
    await this.ensureInitialized();

    try {
      // Get cache entry count and total size
      const cacheStmt = this.db.prepare(`
        SELECT 
          COUNT(*) as entry_count,
          SUM(LENGTH(projects)) as total_size,
          MIN(created_at) as oldest_entry,
          MAX(created_at) as newest_entry
        FROM projects_cache
      `);
      const cacheInfo = cacheStmt.get();

      // Get hit/miss ratio from last 100 operations
      const statsStmt = this.db.prepare(`
        SELECT 
          operation,
          hit,
          COUNT(*) as count,
          AVG(execution_time_ms) as avg_time
        FROM cache_stats 
        WHERE created_at > ? 
        GROUP BY operation, hit
        ORDER BY operation, hit
      `);
      const statsRows = statsStmt.all(Date.now() - 24 * 60 * 60 * 1000);

      const stats = {
        entryCount: cacheInfo?.entry_count || 0,
        totalSize: cacheInfo?.total_size || 0,
        oldestEntry: cacheInfo?.oldest_entry,
        newestEntry: cacheInfo?.newest_entry,
        operations: {}
      };

      // Process operation statistics
      for (const row of statsRows) {
        const op = row.operation;
        if (!stats.operations[op]) {
          stats.operations[op] = { hits: 0, misses: 0, avgTime: 0 };
        }

        if (row.hit) {
          stats.operations[op].hits = row.count;
          stats.operations[op].avgTime = row.avg_time;
        } else {
          stats.operations[op].misses = row.count;
        }
      }

      return stats;
    } catch (error) {
      this.debugLog(`Failed to get cache stats: ${error.message}`);
      return { entryCount: 0, totalSize: 0, operations: {} };
    }
  }

  /**
   * Generate encryption key based on machine ID and user
   */
  getEncryptionKey() {
    const machineId = os.hostname() + os.userInfo().username;
    return crypto.createHash('sha256').update(machineId).digest();
  }

  /**
   * Encrypt text using AES-256-GCM
   */
  encrypt(text) {
    if (!text) return null;
    
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv, authTag, and encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt text using AES-256-GCM
   */
  decrypt(encryptedData) {
    if (!encryptedData) return null;
    
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) return null;
      
      const key = this.getEncryptionKey();
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.debugLog(`Failed to decrypt: ${error.message}`);
      return null;
    }
  }

  /**
   * Save instance credentials (encrypted)
   */
  async saveCredentials(project, instance, user, password, saveEnabled = true) {
    await this.init();
    
    try {
      const encryptedPassword = password ? this.encrypt(password) : null;
      const now = Date.now();
      
      const stmt = this.db.prepare(`
        INSERT INTO instance_credentials (project, instance, user, password, save_enabled, last_used, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project, instance) 
        DO UPDATE SET 
          user = excluded.user,
          password = excluded.password,
          save_enabled = excluded.save_enabled,
          last_used = excluded.last_used,
          updated_at = excluded.updated_at
      `);
      
      stmt.run(project, instance, user, encryptedPassword, saveEnabled ? 1 : 0, now, now, now);
      
      this.debugLog(`Saved credentials for ${project}:${instance}`);
      return true;
    } catch (error) {
      this.debugLog(`Failed to save credentials: ${error.message}`);
      return false;
    }
  }

  /**
   * Get instance credentials (decrypted)
   */
  async getCredentials(project, instance) {
    await this.init();
    
    try {
      const stmt = this.db.prepare(`
        SELECT user, password, save_enabled 
        FROM instance_credentials 
        WHERE project = ? AND instance = ?
      `);
      
      const row = stmt.get(project, instance);
      
      if (!row) {
        return null;
      }
      
      // Update last_used timestamp
      const updateStmt = this.db.prepare(`
        UPDATE instance_credentials 
        SET last_used = ? 
        WHERE project = ? AND instance = ?
      `);
      updateStmt.run(Date.now(), project, instance);
      
      return {
        user: row.user,
        password: row.password ? this.decrypt(row.password) : null,
        saveEnabled: row.save_enabled === 1
      };
    } catch (error) {
      this.debugLog(`Failed to get credentials: ${error.message}`);
      return null;
    }
  }

  /**
   * Clear specific instance credentials
   */
  async clearCredentials(project, instance) {
    await this.init();
    
    try {
      const stmt = this.db.prepare(`
        DELETE FROM instance_credentials 
        WHERE project = ? AND instance = ?
      `);
      
      const result = stmt.run(project, instance);
      
      if (result.changes > 0) {
        this.debugLog(`Cleared credentials for ${project}:${instance}`);
        return true;
      }
      
      return false;
    } catch (error) {
      this.debugLog(`Failed to clear credentials: ${error.message}`);
      return false;
    }
  }

  /**
   * Clear all saved credentials
   */
  async clearAllCredentials() {
    await this.init();
    
    try {
      const stmt = this.db.prepare('DELETE FROM instance_credentials');
      const result = stmt.run();
      
      this.debugLog(`Cleared ${result.changes} saved credentials`);
      return result.changes;
    } catch (error) {
      this.debugLog(`Failed to clear all credentials: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get all saved credentials (for listing purposes, passwords not included)
   */
  async listSavedCredentials() {
    await this.init();
    
    try {
      const stmt = this.db.prepare(`
        SELECT project, instance, user, save_enabled, last_used 
        FROM instance_credentials 
        ORDER BY last_used DESC
      `);
      
      const rows = stmt.all();
      
      return rows.map(row => ({
        project: row.project,
        instance: row.instance,
        user: row.user,
        saveEnabled: row.save_enabled === 1,
        lastUsed: new Date(row.last_used)
      }));
    } catch (error) {
      this.debugLog(`Failed to list credentials: ${error.message}`);
      return [];
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpired() {
    try {
      const stmt = this.db.prepare(
        'DELETE FROM projects_cache WHERE expires_at < ?'
      );
      const result = stmt.run(Date.now());

      const deletedCount = result.changes || 0;
      if (deletedCount > 0) {
        this.debugLog(`Cleaned up ${deletedCount} expired cache entries`);
      }

      // Also cleanup old statistics (keep last 1000 entries)
      const statsStmt = this.db.prepare(`
        DELETE FROM cache_stats 
        WHERE id NOT IN (
          SELECT id FROM cache_stats 
          ORDER BY created_at DESC 
          LIMIT 1000
        )
      `);
      statsStmt.run();
    } catch (error) {
      this.debugLog(`Failed to cleanup expired entries: ${error.message}`);
    }
  }

  /**
   * Clean up invalid cache entries (empty project arrays)
   */
  cleanupInvalidCache() {
    try {
      const stmt = this.db.prepare(
        "DELETE FROM projects_cache WHERE project_count = 0 OR projects = '[]'"
      );
      const result = stmt.run();

      const deletedCount = result.changes || 0;
      if (deletedCount > 0) {
        this.debugLog(
          `Cleaned up ${deletedCount} invalid cache entries with empty project arrays`
        );
      }
    } catch (error) {
      this.debugLog(
        `Failed to cleanup invalid cache entries: ${error.message}`
      );
    }
  }

  /**
   * Record cache operation statistics
   * @param {string} operation - Operation type
   * @param {string} cacheKey - Cache key involved
   * @param {boolean} hit - Whether operation was a cache hit
   * @param {number} executionTime - Execution time in milliseconds
   */
  recordStats(operation, cacheKey, hit, executionTime) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO cache_stats (operation, cache_key, hit, execution_time_ms, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(
        operation,
        cacheKey,
        hit ? 1 : 0,
        Math.round(executionTime),
        Date.now()
      );
    } catch (error) {
      // Silently fail on stats recording to not impact main functionality
      this.debugLog(`Failed to record stats: ${error.message}`);
    }
  }

  /**
   * Ensure cache is initialized
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  /**
   * Debug logging function
   * @param {string} message - Debug message
   */
  debugLog(message) {
    if (process.env.VERBOSE === 'true' || process.env.DEBUG === 'true') {
      if (console.log) console.log('[PersistentCache]', message);
      if (console.debug) console.debug(`[PersistentCache] ${message}`);
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      this.debugLog('Cache connection closed');
    }
  }
}

// Export singleton instance
export default new PersistentCache();
