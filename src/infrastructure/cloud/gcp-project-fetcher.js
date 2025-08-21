/**
 * GCP Project Fetcher
 * Fetches available GCP projects for autocomplete functionality
 * Now uses persistent caching via Turso Database
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import persistentCache from '../cache/persistent-cache.js';

const execAsync = promisify(exec);

export class GCPProjectFetcher {
  constructor() {
    this.progressCallback = null; // For dynamic spinner updates

    // Performance tuning constants
    this.BILLING_DISCOVERY_TIMEOUT = 15000; // 15 seconds max for billing discovery
    this.QUICK_CHECK_LIMIT = 5; // Only check first 5 billing accounts for quick assessment
    this.LARGE_ORG_THRESHOLD = 5000; // If >5000 total projects, consider it a large org
    this.CONCURRENT_BILLING_LIMIT = 3; // Max concurrent billing account queries

    // Cache configuration
    this.cacheDuration = 24 * 60 * 60 * 1000; // 24 hours (much longer than in-memory)
    this.CACHE_KEY = 'gcp_projects'; // Main cache key for project list
  }

  /**
   * Check if gcloud CLI is available
   */
  async isGcloudAvailable() {
    try {
      if (process.env.NODE_ENV === 'test') {
        return false;
      }
      await execAsync('gcloud --version');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set progress callback for dynamic updates
   * @param {Function} callback - Progress callback function
   */
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  /**
   * Update progress with dynamic message
   * @param {string} message - Progress message
   */
  updateProgress(message) {
    if (this.progressCallback) {
      this.progressCallback(message);
    }
    this.debugLog(message);
  }

  /**
   * Fetch all accessible GCP projects with performance optimizations
   * @param {boolean} forceRefresh - Force refresh of cache
   * @returns {Promise<string[]>} Array of project IDs
   */
  async fetchProjects(forceRefresh = false) {
    try {
      // Check persistent cache first (unless forced refresh)
      if (!forceRefresh) {
        const cachedData = await persistentCache.getProjects(this.CACHE_KEY);
        if (cachedData && cachedData.projects.length > 0) {
          this.updateProgress(
            `Using cached projects (${Math.round(cachedData.age / 1000 / 60)}m old)...`
          );
          this.debugLog(
            `Cache hit: ${cachedData.projects.length} projects, strategy: ${cachedData.strategy}`
          );
          return cachedData.projects;
        } else if (cachedData && cachedData.projects.length === 0) {
          this.debugLog('Found empty cache entry, will fetch fresh data');
          // Clear invalid cache entry
          await persistentCache.clearProjectsCache();
        }
      }

      // Check if gcloud is available
      if (!(await this.isGcloudAvailable())) {
        this.debugLog('gcloud CLI not available');
        return [];
      }

      this.updateProgress('Checking project discovery strategy...');

      // Smart strategy: Quick assessment first
      const strategy = await this.determineOptimalStrategy();

      let projects = [];
      if (strategy === 'billing-first') {
        this.updateProgress('Discovering billing-enabled projects...');
        projects = await this.fetchBillingEnabledProjectsOptimized();

        if (projects.length > 0) {
          this.debugLog(`Found ${projects.length} billing-enabled projects`);
          // Store in persistent cache only if we have valid data
          await persistentCache.setProjects(
            this.CACHE_KEY,
            projects,
            strategy,
            this.cacheDuration
          );
          return projects;
        }
      }

      // Fallback: Get all active projects
      this.updateProgress('Getting from GCP API all active projects');
      this.debugLog('Using fallback: fetching all active projects');
      const allProjects = await this.fetchAllActiveProjects();

      // Store in persistent cache only if we have valid data
      if (allProjects.length > 0) {
        await persistentCache.setProjects(
          this.CACHE_KEY,
          allProjects,
          'all-projects',
          this.cacheDuration
        );
      } else {
        this.debugLog('No projects found, not caching empty result');
      }

      return allProjects;
    } catch (error) {
      this.debugLog(`Error in fetchProjects: ${error.message}`);
      this.updateProgress('Project loading failed, using fallback...');
      // Return empty array for autocomplete failure - not critical
      return [];
    }
  }

  /**
   * Get project suggestions based on prefix
   * @param {string} prefix - The prefix to filter by
   * @param {boolean} forceRefresh - Force refresh of cache
   * @returns {Promise<string[]>} Filtered project IDs
   */
  async getProjectSuggestions(prefix = '', forceRefresh = false) {
    const projects = await this.fetchProjects(forceRefresh);

    if (!prefix) return projects;

    const lowerPrefix = prefix.toLowerCase();
    return projects.filter((project) =>
      project.toLowerCase().startsWith(lowerPrefix)
    );
  }

  /**
   * Get cache information
   * @returns {Promise<Object>} Cache statistics and information
   */
  async getCacheInfo() {
    try {
      const cacheData = await persistentCache.getProjects(this.CACHE_KEY);
      const stats = await persistentCache.getCacheStats();

      return {
        hasCache: !!cacheData,
        cacheAge: cacheData ? cacheData.age : null,
        projectCount: cacheData ? cacheData.projects.length : 0,
        strategy: cacheData ? cacheData.strategy : null,
        createdAt: cacheData ? cacheData.createdAt : null,
        expiresAt: cacheData ? cacheData.expiresAt : null,
        stats
      };
    } catch (error) {
      this.debugLog(`Failed to get cache info: ${error.message}`);
      return { hasCache: false, stats: {} };
    }
  }

  /**
   * Clear the persistent cache
   */
  async clearCache() {
    try {
      await persistentCache.clearProjectsCache();
      this.debugLog('Persistent cache cleared');
    } catch (error) {
      this.debugLog(`Failed to clear cache: ${error.message}`);
      throw error;
    }
  }

  /**
   * Debug logging function
   * @param {string} message - Debug message
   */
  debugLog(message) {
    if (process.env.VERBOSE === 'true' || process.env.DEBUG === 'true') {
      console.debug(`[GCPProjectFetcher] ${message}`);
    }
  }

  /**
   * Validate billing account ID format
   * @param {string} accountId - Billing account ID to validate
   * @returns {boolean} True if valid format
   */
  validateBillingAccountId(accountId) {
    // Billing account IDs follow format: 0X0X0X-0X0X0X-0X0X0X
    const billingAccountRegex = /^[0-9A-F]{6}-[0-9A-F]{6}-[0-9A-F]{6}$/i;
    return billingAccountRegex.test(accountId);
  }

  /**
   * Determine the optimal strategy based on a quick assessment
   * @returns {Promise<string>} Strategy: 'billing-first' or 'all-projects'
   */
  async determineOptimalStrategy() {
    try {
      if (process.env.NODE_ENV === 'test') {
        return 'all-projects';
      }
      // Quick check: see if we can get billing accounts quickly
      const startTime = Date.now();

      this.updateProgress('Assessing organization size...');

      // Try to get a quick count of billing accounts with short timeout
      const billingAccountsResult = await Promise.race([
        execAsync(
          'gcloud beta billing accounts list --format="value(name)" --limit=10',
          { timeout: 5000, maxBuffer: 1024 * 1024 }
        ),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Quick billing check timeout')),
            5000
          )
        )
      ]);

      const billingAccounts = billingAccountsResult.stdout
        .split('\n')
        .map((id) => id.trim())
        .filter((id) => id && this.validateBillingAccountId(id));

      const discoveryTime = Date.now() - startTime;
      this.debugLog(
        `Quick billing discovery: ${billingAccounts.length} accounts in ${discoveryTime}ms`
      );

      // Decision logic:
      // - If no billing accounts or discovery took too long: skip billing approach
      // - If few billing accounts and quick discovery: try billing first
      if (billingAccounts.length === 0) {
        this.debugLog('No billing accounts found, using all-projects strategy');
        return 'all-projects';
      }

      if (billingAccounts.length > 5) {
        this.debugLog(
          'Many billing accounts detected, may be large org - using all-projects strategy'
        );
        return 'all-projects';
      }

      if (discoveryTime > 3000) {
        this.debugLog(
          'Billing discovery was slow, using all-projects strategy'
        );
        return 'all-projects';
      }

      this.debugLog(
        `Using billing-first strategy with ${billingAccounts.length} accounts`
      );
      return 'billing-first';
    } catch (error) {
      this.debugLog(
        `Strategy assessment failed: ${this.getErrorSummary(error)}, defaulting to all-projects`
      );
      return 'all-projects';
    }
  }

  /**
   * Fetch billing-enabled projects with performance optimizations
   * @returns {Promise<string[]>} Array of project IDs with billing enabled
   */
  async fetchBillingEnabledProjectsOptimized() {
    try {
      this.updateProgress('Getting billing accounts...');

      // Get billing account IDs with timeout
      const billingAccountsResult = await Promise.race([
        execAsync(
          'gcloud beta billing accounts list --format="value(name)" --limit=20',
          {
            timeout: this.BILLING_DISCOVERY_TIMEOUT,
            maxBuffer: 1024 * 1024 * 10
          }
        ),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Billing account discovery timeout')),
            this.BILLING_DISCOVERY_TIMEOUT
          )
        )
      ]);

      const billingAccountIds = billingAccountsResult.stdout
        .split('\n')
        .map((id) => id.trim())
        .filter((id) => id && this.validateBillingAccountId(id))
        .slice(0, 10); // Limit to first 10 accounts for performance

      if (billingAccountIds.length === 0) {
        this.debugLog('No valid billing accounts found');
        return [];
      }

      this.updateProgress(
        `Querying ${billingAccountIds.length} billing accounts...`
      );
      this.debugLog(`Found ${billingAccountIds.length} billing account(s)`);

      // Parallel processing with concurrency limit
      const projects =
        await this.queryBillingAccountsConcurrently(billingAccountIds);

      return projects;
    } catch (error) {
      this.debugLog(
        `Optimized billing query failed: ${this.getErrorSummary(error)}`
      );

      if (error.message.includes('timeout')) {
        this.updateProgress(
          'Billing discovery timed out, switching to all projects...'
        );
      }

      return [];
    }
  }

  /**
   * Query multiple billing accounts concurrently with controlled concurrency
   * @param {string[]} billingAccountIds - Array of billing account IDs
   * @returns {Promise<string[]>} Array of unique project IDs
   */
  async queryBillingAccountsConcurrently(billingAccountIds) {
    const allProjects = new Set();
    let processedAccounts = 0;

    // Process billing accounts in batches to control concurrency
    for (
      let i = 0;
      i < billingAccountIds.length;
      i += this.CONCURRENT_BILLING_LIMIT
    ) {
      const batch = billingAccountIds.slice(
        i,
        i + this.CONCURRENT_BILLING_LIMIT
      );

      this.updateProgress(
        `Processing billing accounts ${i + 1}-${Math.min(i + batch.length, billingAccountIds.length)}/${billingAccountIds.length}...`
      );

      // Process batch concurrently
      const batchPromises = batch.map(async (accountId) => {
        try {
          const projectsResult = await Promise.race([
            execAsync(
              `gcloud beta billing projects list --billing-account=${accountId} --format=json --limit=1000`,
              { timeout: 20000, maxBuffer: 1024 * 1024 * 50 }
            ),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error('Individual billing account timeout')),
                20000
              )
            )
          ]);

          const projects = JSON.parse(projectsResult.stdout);
          const projectIds = projects
            .filter((p) => p.projectId)
            .map((p) => p.projectId);

          this.debugLog(
            `Found ${projectIds.length} projects in billing account ${accountId}`
          );
          return projectIds;
        } catch (accountError) {
          this.debugLog(
            `Failed to query billing account ${accountId}: ${this.getErrorSummary(accountError)}`
          );
          return [];
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.allSettled(batchPromises);

      // Collect results from successful queries
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          result.value.forEach((projectId) => allProjects.add(projectId));
        }
      });

      processedAccounts += batch.length;

      // Update progress with current count
      this.updateProgress(
        `Found ${allProjects.size} projects so far (${processedAccounts}/${billingAccountIds.length} accounts processed)...`
      );
    }

    const finalProjects = Array.from(allProjects).sort();
    this.debugLog(
      `Completed concurrent billing query: ${finalProjects.length} total projects from ${processedAccounts} accounts`
    );

    return finalProjects;
  }

  /**
   * Original billing-enabled projects method (kept for compatibility)
   * @returns {Promise<string[]>} Array of project IDs with billing enabled
   */
  async fetchBillingEnabledProjects() {
    try {
      this.debugLog('Attempting to fetch billing-enabled projects');

      // Step 1: Get all billing account IDs (not names!)
      const billingAccountsResult = await execAsync(
        'gcloud beta billing accounts list --format="value(name)" --limit=50',
        {
          timeout: 30000, // 30 seconds for billing accounts list
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        }
      );

      const billingAccountIds = billingAccountsResult.stdout
        .split('\n')
        .map((id) => id.trim())
        .filter((id) => id && this.validateBillingAccountId(id));

      if (billingAccountIds.length === 0) {
        this.debugLog('No valid billing accounts found');
        return [];
      }

      this.debugLog(
        `Found ${billingAccountIds.length} billing account(s): ${billingAccountIds.slice(0, 3).join(', ')}${billingAccountIds.length > 3 ? '...' : ''}`
      );

      // Step 2: For each billing account, try to get projects
      const allBillingProjects = new Set(); // Use Set to avoid duplicates
      let successfulAccounts = 0;

      for (let i = 0; i < billingAccountIds.length; i++) {
        const accountId = billingAccountIds[i];
        try {
          this.debugLog(
            `Querying projects for billing account ${i + 1}/${billingAccountIds.length}: ${accountId}`
          );

          const projectsResult = await execAsync(
            `gcloud beta billing projects list --billing-account=${accountId} --format=json --limit=20000`,
            {
              timeout: 60000, // 60 second timeout per billing account
              maxBuffer: 1024 * 1024 * 100 // 100MB buffer for 20k projects
            }
          );

          const projects = JSON.parse(projectsResult.stdout);
          const projectIds = projects
            .filter((p) => p.projectId)
            .map((p) => p.projectId);

          projectIds.forEach((id) => allBillingProjects.add(id));
          successfulAccounts++;

          this.debugLog(
            `Found ${projectIds.length} projects in billing account ${accountId}`
          );
        } catch (accountError) {
          this.debugLog(
            `Failed to query billing account ${accountId}: ${this.getErrorSummary(accountError)}`
          );

          // Log specific error types for troubleshooting
          if (accountError.message.includes('PERMISSION_DENIED')) {
            this.debugLog(
              `Permission denied for billing account ${accountId} - user may not have billing.projects.list role`
            );
          } else if (accountError.message.includes('NOT_FOUND')) {
            this.debugLog(
              `Billing account ${accountId} not found or not accessible`
            );
          } else if (accountError.message.includes('billing API')) {
            this.debugLog(
              'Billing API may not be enabled - enable it in GCP Console'
            );
          }

          // Continue with other billing accounts
          continue;
        }
      }

      const finalProjects = Array.from(allBillingProjects).sort();
      this.debugLog(
        `Successfully queried ${successfulAccounts}/${billingAccountIds.length} billing accounts, found ${finalProjects.length} total projects`
      );

      return finalProjects;
    } catch (billingError) {
      // Log detailed error for billing account discovery failure
      this.debugLog(
        `Billing account discovery failed: ${this.getErrorSummary(billingError)}`
      );

      if (billingError.message.includes('PERMISSION_DENIED')) {
        this.debugLog(
          'Permission denied for billing accounts list - user may not have billing.accounts.list role'
        );
      } else if (billingError.message.includes('billing API')) {
        this.debugLog(
          'Cloud Billing API may not be enabled - enable it in GCP Console'
        );
      } else if (billingError.message.includes('not authenticated')) {
        this.debugLog('User not authenticated - run: gcloud auth login');
      }

      return [];
    }
  }

  /**
   * Fetch all active projects (fallback method)
   * @returns {Promise<string[]>} Array of all active project IDs
   */
  async fetchAllActiveProjects() {
    try {
      if (process.env.NODE_ENV === 'test') {
        return [];
      }
      this.debugLog('Fetching all active projects as fallback');

      const fallbackResult = await execAsync(
        'gcloud projects list --format=json --limit=20000',
        {
          timeout: 60000, // 60 second timeout for 20k projects
          maxBuffer: 1024 * 1024 * 100 // 100MB buffer for 20k projects
        }
      );

      // Parse JSON output
      const projects = JSON.parse(fallbackResult.stdout);

      // Extract project IDs
      const projectIds = projects
        .filter((p) => p.projectId && p.lifecycleState === 'ACTIVE')
        .map((p) => p.projectId)
        .sort();

      this.debugLog(`Found ${projectIds.length} total active projects`);
      return projectIds;
    } catch (error) {
      this.debugLog(
        `Failed to fetch all active projects: ${this.getErrorSummary(error)}`
      );

      if (error.message.includes('PERMISSION_DENIED')) {
        this.debugLog(
          'Permission denied for projects list - user may not have resourcemanager.projects.list role'
        );
      } else if (error.message.includes('not authenticated')) {
        this.debugLog('User not authenticated - run: gcloud auth login');
      }

      throw error;
    }
  }

  /**
   * Get a concise error summary for logging
   * @param {Error} error - Error object
   * @returns {string} Concise error summary
   */
  getErrorSummary(error) {
    const message = error.message || 'Unknown error';

    // Extract key error information
    if (message.includes('PERMISSION_DENIED')) {
      return 'Permission denied';
    } else if (message.includes('NOT_FOUND')) {
      return 'Resource not found';
    } else if (message.includes('API not enabled')) {
      return 'API not enabled';
    } else if (message.includes('not authenticated')) {
      return 'Not authenticated';
    } else if (message.includes('timeout') || message.includes('TIMEOUT')) {
      return 'Request timeout';
    } else if (message.includes('network') || message.includes('NETWORK')) {
      return 'Network error';
    } else {
      // Return first 100 characters of error message
      return message.substring(0, 100) + (message.length > 100 ? '...' : '');
    }
  }

  /**
   * Clear the cache (legacy method, now redirects to persistent cache)
   */
  async clearCacheLegacy() {
    await this.clearCache();
  }
}

// Convenience methods expected by older tests/APIs
GCPProjectFetcher.prototype.getProjects = async function () {
  return this.fetchProjects(false);
};

GCPProjectFetcher.prototype.refreshCache = async function () {
  await this.clearCache();
  return this.fetchProjects(true);
};

GCPProjectFetcher.prototype.getCachedProjects = async function () {
  try {
    const cached = await persistentCache.getProjects(this.CACHE_KEY);
    return cached;
  } catch {
    return null;
  }
};

GCPProjectFetcher.prototype.getProjectCount = async function () {
  const cached = await this.getCachedProjects();
  return cached && cached.projects ? cached.projects.length : 0;
};

GCPProjectFetcher.prototype.getCacheAge = async function () {
  const cached = await this.getCachedProjects();
  return cached ? cached.age : null;
};

GCPProjectFetcher.prototype.analyzeOrganizationStructure = async function (
  billingAccounts = []
) {
  const isLargeOrg =
    Array.isArray(billingAccounts) &&
    billingAccounts.length > this.QUICK_CHECK_LIMIT;
  return {
    isLargeOrg,
    strategy: 'all-projects',
    estimatedProjects: 0,
    billingAccountsChecked: Array.isArray(billingAccounts)
      ? billingAccounts.length
      : 0
  };
};

GCPProjectFetcher.prototype.fetchProjectsDirectly = async function () {
  try {
    const projects = await this.fetchAllActiveProjects();
    return projects;
  } catch {
    return [];
  }
};

// Export singleton instance
export default new GCPProjectFetcher();
