import { promises as fs } from 'fs';
import path from 'path';

/**
 * Instance Parser Utility
 * Parses instance configuration from various file formats (txt, json, csv)
 */
class InstanceParser {
  /**
   * Parse instance file based on extension
   * @param {string} filePath - Path to the instance file
   * @returns {Promise<Object>} Parsed instance configuration
   */
  async parseFile(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    const content = await fs.readFile(filePath, 'utf8');

    switch (extension) {
      case '.txt':
        return this.parseTxt(content);
      case '.json':
        return this.parseJson(content);
      case '.csv':
        return this.parseCsv(content);
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  }

  /**
   * Parse TXT format (one instance per line)
   * @param {string} content - File content
   * @returns {Object} Parsed configuration
   */
  parseTxt(content) {
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    const instances = lines.map(line => {
      // Support format: project:instance or just instance
      const parts = line.split(':');
      if (parts.length === 2) {
        return { project: parts[0], instance: parts[1] };
      }
      return { instance: line };
    });

    return {
      strategy: 'simple',
      sources: instances,
      targets: null // To be specified via CLI or interactive
    };
  }

  /**
   * Parse JSON format with full configuration
   * @param {string} content - File content
   * @returns {Object} Parsed configuration
   */
  parseJson(content) {
    const data = JSON.parse(content);

    // Support multiple JSON formats
    if (data.migrations) {
      // Full migration mapping format
      return this.normalizeMigrationMapping(data);
    } else if (data.instances) {
      // Simple instance list format
      return {
        strategy: data.strategy || 'simple',
        sources: data.instances.map(inst => 
          typeof inst === 'string' 
            ? { instance: inst }
            : inst
        ),
        targets: data.targets || null
      };
    } else if (Array.isArray(data)) {
      // Array of instances
      return {
        strategy: 'simple',
        sources: data.map(inst => 
          typeof inst === 'string' 
            ? { instance: inst }
            : inst
        ),
        targets: null
      };
    }

    throw new Error('Invalid JSON format');
  }

  /**
   * Parse CSV format
   * @param {string} content - File content
   * @returns {Object} Parsed configuration
   */
  parseCsv(content) {
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);

    if (lines.length === 0) {
      throw new Error('Empty CSV file');
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const migrations = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const row = {};

      headers.forEach((header, index) => {
        if (values[index]) {
          row[header] = values[index].trim();
        }
      });

      // Convert to standard format
      const migration = {
        source: {
          project: row.source_project || row.project,
          instance: row.source_instance || row.instance,
          databases: row.databases ? row.databases.split(';').map(d => d.trim()) : null
        },
        target: {
          project: row.target_project,
          instance: row.target_instance
        },
        version: row.version || null,
        options: {
          includeAll: row.databases === 'all',
          schemaOnly: row.mode === 'schema',
          dataOnly: row.mode === 'data'
        }
      };

      migrations.push(migration);
    }

    return this.groupMigrationsByStrategy(migrations);
  }

  /**
   * Parse a single CSV line handling quoted values
   * @param {string} line - CSV line
   * @returns {string[]} Parsed values
   */
  parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  /**
   * Normalize migration mapping to standard format
   * @param {Object} data - Raw migration data
   * @returns {Object} Normalized configuration
   */
  normalizeMigrationMapping(data) {
    const normalized = {
      strategy: data.strategy || 'custom-mapping',
      autoDetectVersion: data.autoDetectVersion !== false,
      conflictResolution: data.conflictResolution || 'fail',
      migrations: []
    };

    if (data.migrations) {
      normalized.migrations = data.migrations.map(m => ({
        sources: m.sources.map(s => 
          typeof s === 'string' 
            ? { instance: s }
            : { project: s.project, instance: s.instance }
        ),
        target: typeof m.target === 'string'
          ? { instance: m.target }
          : { project: m.target.project, instance: m.target.instance },
        databases: m.databases === 'all' ? null : m.databases,
        includeAll: m.databases === 'all',
        conflictResolution: m.conflictResolution || data.conflictResolution
      }));
    }

    return normalized;
  }

  /**
   * Group migrations by strategy (version-based or custom)
   * @param {Array} migrations - List of migrations
   * @returns {Object} Grouped configuration
   */
  groupMigrationsByStrategy(migrations) {
    // Check if migrations can be grouped by version
    const byVersion = {};
    let canGroupByVersion = true;

    migrations.forEach(m => {
      if (!m.version) {
        canGroupByVersion = false;
        return;
      }

      if (!byVersion[m.version]) {
        byVersion[m.version] = {
          sources: [],
          target: m.target
        };
      } else if (
        byVersion[m.version].target.project !== m.target.project ||
        byVersion[m.version].target.instance !== m.target.instance
      ) {
        // Different targets for same version - can't group
        canGroupByVersion = false;
        return;
      }

      byVersion[m.version].sources.push(m.source);
    });

    if (canGroupByVersion && Object.keys(byVersion).length > 0) {
      return {
        strategy: 'version-based',
        autoDetectVersion: false,
        versionMapping: byVersion
      };
    }

    // Fall back to custom mapping
    return {
      strategy: 'custom-mapping',
      migrations: migrations
    };
  }

  /**
   * Validate parsed configuration
   * @param {Object} config - Parsed configuration
   * @returns {Object} Validation result
   */
  validateConfiguration(config) {
    const errors = [];
    const warnings = [];

    if (!config.strategy) {
      errors.push('Migration strategy is required');
    }

    if (config.strategy === 'simple' && (!config.sources || config.sources.length === 0)) {
      errors.push('At least one source instance is required');
    }

    if (config.strategy === 'version-based' && !config.versionMapping) {
      errors.push('Version mapping is required for version-based strategy');
    }

    if (config.strategy === 'custom-mapping' && (!config.migrations || config.migrations.length === 0)) {
      errors.push('At least one migration mapping is required');
    }

    // Check for duplicate sources
    const sourceSet = new Set();
    const sources = config.sources || [];
    
    if (config.migrations) {
      config.migrations.forEach(m => {
        if (m.sources) {
          sources.push(...m.sources);
        } else if (m.source) {
          sources.push(m.source);
        }
      });
    }

    sources.forEach(s => {
      const key = `${s.project || 'default'}:${s.instance}`;
      if (sourceSet.has(key)) {
        warnings.push(`Duplicate source instance: ${key}`);
      }
      sourceSet.add(key);
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate migration configuration from parsed data
   * @param {Object} parsedData - Parsed instance data
   * @param {Object} cliOptions - Additional CLI options
   * @returns {Object} Complete migration configuration
   */
  generateMigrationConfig(parsedData, cliOptions = {}) {
    const config = {
      ...parsedData,
      options: {
        dryRun: cliOptions.dryRun || false,
        verbose: cliOptions.verbose || false,
        retryAttempts: cliOptions.retryAttempts || 3,
        jobs: cliOptions.jobs || 1,
        forceCompatibility: cliOptions.forceCompatibility || false,
        ...parsedData.options
      }
    };

    // Apply CLI-specified target if not in parsed data
    if (cliOptions.targetProject && cliOptions.targetInstance) {
      if (config.strategy === 'simple') {
        config.target = {
          project: cliOptions.targetProject,
          instance: cliOptions.targetInstance
        };
      }
    }

    // Apply default project if not specified
    if (cliOptions.defaultProject) {
      if (config.sources) {
        config.sources = config.sources.map(s => ({
          project: s.project || cliOptions.defaultProject,
          ...s
        }));
      }
      
      if (config.migrations) {
        config.migrations = config.migrations.map(m => ({
          ...m,
          sources: m.sources?.map(s => ({
            project: s.project || cliOptions.defaultProject,
            ...s
          })),
          source: m.source ? {
            project: m.source.project || cliOptions.defaultProject,
            ...m.source
          } : undefined,
          target: {
            project: m.target.project || cliOptions.defaultProject,
            ...m.target
          }
        }));
      }
    }

    return config;
  }
}

export default InstanceParser;