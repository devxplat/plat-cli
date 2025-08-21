/**
 * Migration Mapping Model
 * Manages N:N, N:1, and 1:N migration mappings for CloudSQL instances
 */
class MigrationMapping {
  constructor(data = {}) {
    this.strategy = data.strategy || 'simple'; // simple, consolidate, version-based, custom-mapping
    this.sources = data.sources || [];
    this.targets = data.targets || (data.target ? [data.target] : []);
    this.migrations = data.migrations || [];
    this.versionMapping = data.versionMapping || {};
    this.conflictResolution = data.conflictResolution || 'fail'; // fail, prefix, suffix, merge
    this.autoDetectVersion = data.autoDetectVersion !== false;
    this.options = data.options || {}; // Store additional options like dryRun, verbose, etc.
    this.metadata = {
      createdAt: new Date().toISOString(),
      totalSources: 0,
      totalTargets: 0,
      mappingType: null, // N:1, N:N, 1:N
      ...data.metadata
    };

    this._analyzeMappingType();
  }

  /**
   * Analyze and determine the mapping type
   * @private
   */
  _analyzeMappingType() {
    const sourceCount = this._countUniqueSources();
    const targetCount = this._countUniqueTargets();

    if (sourceCount > 1 && targetCount === 1) {
      this.metadata.mappingType = 'N:1';
    } else if (sourceCount > 1 && targetCount > 1) {
      this.metadata.mappingType = 'N:N';
    } else if (sourceCount === 1 && targetCount > 1) {
      this.metadata.mappingType = '1:N';
    } else {
      this.metadata.mappingType = '1:1';
    }

    this.metadata.totalSources = sourceCount;
    this.metadata.totalTargets = targetCount;
  }

  /**
   * Count unique source instances
   * @private
   */
  _countUniqueSources() {
    const sources = new Set();

    if (this.sources.length > 0) {
      this.sources.forEach(s => {
        sources.add(`${s.project || 'default'}:${s.instance}`);
      });
    }

    if (this.migrations.length > 0) {
      this.migrations.forEach(m => {
        if (m.sources) {
          m.sources.forEach(s => {
            sources.add(`${s.project || 'default'}:${s.instance}`);
          });
        } else if (m.source) {
          sources.add(`${m.source.project || 'default'}:${m.source.instance}`);
        }
      });
    }

    if (this.versionMapping) {
      Object.values(this.versionMapping).forEach(mapping => {
        if (mapping.sources) {
          mapping.sources.forEach(s => {
            sources.add(`${s.project || 'default'}:${s.instance}`);
          });
        }
      });
    }

    return sources.size;
  }

  /**
   * Count unique target instances
   * @private
   */
  _countUniqueTargets() {
    const targets = new Set();

    if (this.targets && this.targets.length > 0) {
      this.targets.forEach(t => {
        if (t) {
          targets.add(`${t.project || 'default'}:${t.instance}`);
        }
      });
    }

    if (this.migrations.length > 0) {
      this.migrations.forEach(m => {
        if (m.target) {
          targets.add(`${m.target.project || 'default'}:${m.target.instance}`);
        }
      });
    }

    if (this.versionMapping) {
      Object.values(this.versionMapping).forEach(mapping => {
        if (mapping.target) {
          targets.add(`${mapping.target.project || 'default'}:${mapping.target.instance}`);
        }
      });
    }

    return targets.size;
  }

  /**
   * Generate execution plan for migrations
   * @returns {Array} List of individual migration tasks
   */
  generateExecutionPlan() {
    const tasks = [];

    switch (this.strategy) {
      case 'simple':
        // All sources to single target or 1:1 mapping
        if (this.targets.length === 1) {
          // N:1 consolidation
          this.sources.forEach(source => {
            tasks.push({
              source,
              target: this.targets[0],
              databases: source.databases || 'all',
              conflictResolution: this.conflictResolution
            });
          });
        } else {
          // 1:1 mapping by index
          this.sources.forEach((source, index) => {
            if (this.targets[index]) {
              const target = this.targets[index];
              tasks.push({
                source: {
                  ...source,
                  password: source.password,
                  user: source.user || 'postgres'
                },
                target: {
                  ...target,
                  password: target.password || source.password,
                  user: target.user || 'postgres'
                },
                databases: source.databases || 'all'
              });
            }
          });
        }
        break;

      case 'consolidate':
        // Explicit N:1 consolidation
        const consolidationTarget = this.targets[0] || this.target;
        this.sources.forEach(source => {
          tasks.push({
            source: {
              ...source,
              password: source.password,
              user: source.user || 'postgres'
            },
            target: {
              ...consolidationTarget,
              password: consolidationTarget.password || source.password,
              user: consolidationTarget.user || 'postgres'
            },
            databases: source.databases || 'all',
            conflictResolution: this.conflictResolution,
            prefixWith: this.conflictResolution === 'prefix' ? source.instance : null
          });
        });
        break;

      case 'version-based':
        // Group by PostgreSQL version
        Object.entries(this.versionMapping).forEach(([version, mapping]) => {
          mapping.sources.forEach(source => {
            tasks.push({
              source: {
                ...source,
                password: source.password,
                user: source.user || 'postgres'
              },
              target: {
                ...mapping.target,
                password: mapping.target.password || source.password,
                user: mapping.target.user || 'postgres'
              },
              databases: source.databases || 'all',
              version,
              conflictResolution: this.conflictResolution
            });
          });
        });
        break;

      case 'custom-mapping':
        // Explicit custom mappings
        this.migrations.forEach(migration => {
          if (migration.sources) {
            // Multiple sources to single target
            migration.sources.forEach(source => {
              tasks.push({
                source: typeof source === 'string' ? { instance: source } : source,
                target: migration.target,
                databases: migration.databases || 'all',
                includeAll: migration.includeAll,
                conflictResolution: migration.conflictResolution || this.conflictResolution
              });
            });
          } else if (migration.source) {
            // Single source to target
            tasks.push({
              source: migration.source,
              target: migration.target,
              databases: migration.databases || 'all',
              includeAll: migration.includeAll
            });
          }
        });
        break;

      default:
        throw new Error(`Unknown strategy: ${this.strategy}`);
    }

    return tasks;
  }

  /**
   * Validate the mapping configuration
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    // Check strategy
    const validStrategies = ['simple', 'consolidate', 'version-based', 'custom-mapping'];
    if (!validStrategies.includes(this.strategy)) {
      errors.push(`Invalid strategy: ${this.strategy}`);
    }

    // Validate based on strategy
    switch (this.strategy) {
      case 'simple':
      case 'consolidate':
        if (this.sources.length === 0) {
          errors.push('At least one source instance is required');
        }
        if (this.targets.length === 0 && !this.target) {
          errors.push('At least one target instance is required');
        }
        break;

      case 'version-based':
        if (Object.keys(this.versionMapping).length === 0) {
          errors.push('Version mapping is required for version-based strategy');
        }
        break;

      case 'custom-mapping':
        if (this.migrations.length === 0) {
          errors.push('At least one migration mapping is required');
        }
        break;
    }

    // Check for conflicts in consolidation scenarios
    if (this.metadata.mappingType === 'N:1' && this.conflictResolution === 'fail') {
      warnings.push('N:1 mapping with "fail" conflict resolution may cause issues with duplicate database names');
    }

    // Validate individual sources and targets
    const validateInstance = (inst, type) => {
      if (!inst.instance) {
        errors.push(`${type} instance name is required`);
      }
      // Project is optional as it can be defaulted
    };

    this.sources.forEach(s => validateInstance(s, 'Source'));
    this.targets.forEach(t => validateInstance(t, 'Target'));

    // Check for duplicate source-target pairs only if strategy is valid
    if (validStrategies.includes(this.strategy)) {
      const pairs = new Set();
      try {
        const tasks = this.generateExecutionPlan();
        
        tasks.forEach(task => {
          const key = `${task.source.project || 'default'}:${task.source.instance}->${task.target.project || 'default'}:${task.target.instance}`;
          if (pairs.has(key)) {
            warnings.push(`Duplicate migration path: ${key}`);
          }
          pairs.add(key);
        });
      } catch {
        // If generateExecutionPlan fails, just skip duplicate check
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Resolve database name conflicts for N:1 migrations
   * @param {Array} databases - List of databases from multiple sources
   * @returns {Array} Resolved database list
   */
  resolveDatabaseConflicts(databases) {
    const resolved = [];
    const seen = new Map();

    databases.forEach(db => {
      const sourceName = `${db.source.project || 'default'}:${db.source.instance}`;
      const dbName = db.name;

      if (!seen.has(dbName)) {
        seen.set(dbName, []);
      }
      seen.get(dbName).push(sourceName);
    });

    seen.forEach((sources, dbName) => {
      if (sources.length === 1) {
        // No conflict
        resolved.push({ name: dbName, source: sources[0] });
      } else {
        // Conflict detected
        switch (this.conflictResolution) {
          case 'prefix':
            sources.forEach(source => {
              const instanceName = source.split(':')[1];
              resolved.push({
                name: `${instanceName}_${dbName}`,
                originalName: dbName,
                source
              });
            });
            break;

          case 'suffix':
            sources.forEach((source, index) => {
              resolved.push({
                name: index === 0 ? dbName : `${dbName}_${index + 1}`,
                originalName: dbName,
                source
              });
            });
            break;

          case 'merge':
            // Keep single name, merge data (requires special handling in migration)
            resolved.push({
              name: dbName,
              sources,
              merged: true
            });
            break;

          case 'fail':
          default:
            throw new Error(`Database name conflict: ${dbName} exists in multiple sources`);
        }
      }
    });

    return resolved;
  }

  /**
   * Group sources by PostgreSQL version
   * @param {Array} instances - List of instances with version info
   * @returns {Object} Instances grouped by version
   */
  groupByVersion(instances) {
    const grouped = {};

    instances.forEach(inst => {
      const version = inst.version || 'unknown';
      if (!grouped[version]) {
        grouped[version] = [];
      }
      grouped[version].push(inst);
    });

    return grouped;
  }

  /**
   * Convert to operation configs for execution
   * @returns {Array} Array of OperationConfig objects
   */
  toOperationConfigs() {
    const tasks = this.generateExecutionPlan();
    
    return tasks.map(task => ({
      source: {
        project: task.source.project,
        instance: task.source.instance,
        databases: task.databases === 'all' ? null : task.databases
      },
      target: {
        project: task.target.project,
        instance: task.target.instance
      },
      options: {
        includeAll: task.databases === 'all' || task.includeAll,
        conflictResolution: task.conflictResolution,
        prefixWith: task.prefixWith,
        version: task.version
      },
      metadata: {
        toolName: 'gcp.cloudsql.migrate',
        mappingStrategy: this.strategy,
        mappingType: this.metadata.mappingType,
        source: 'batch-migration'
      }
    }));
  }

  /**
   * Get summary of the mapping
   * @returns {Object} Summary information
   */
  getSummary() {
    const tasks = this.generateExecutionPlan();
    
    return {
      strategy: this.strategy,
      mappingType: this.metadata.mappingType,
      totalSources: this.metadata.totalSources,
      totalTargets: this.metadata.totalTargets,
      totalMigrations: tasks.length,
      conflictResolution: this.conflictResolution,
      tasks: tasks.map(t => ({
        from: `${t.source.project || 'default'}:${t.source.instance}`,
        to: `${t.target.project || 'default'}:${t.target.instance}`,
        databases: t.databases
      }))
    };
  }

  /**
   * Clone the mapping with modifications
   * @param {Object} modifications - Properties to modify
   * @returns {MigrationMapping} New mapping instance
   */
  clone(modifications = {}) {
    return new MigrationMapping({
      ...this.toJSON(),
      ...modifications
    });
  }

  /**
   * Convert to JSON
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      strategy: this.strategy,
      sources: this.sources,
      targets: this.targets,
      migrations: this.migrations,
      versionMapping: this.versionMapping,
      conflictResolution: this.conflictResolution,
      autoDetectVersion: this.autoDetectVersion,
      options: this.options,
      metadata: this.metadata
    };
  }

  /**
   * Create from instance file parser output
   * @param {Object} parserOutput - Output from InstanceParser
   * @param {Object} options - Additional options
   * @returns {MigrationMapping} New mapping instance
   */
  static fromParserOutput(parserOutput, options = {}) {
    return new MigrationMapping({
      ...parserOutput,
      ...options
    });
  }
}

export default MigrationMapping;