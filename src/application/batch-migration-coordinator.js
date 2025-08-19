import OperationConfig from '../domain/models/operation-config.js';
import ExecutionState from '../domain/models/execution-state.js';

/**
 * Batch Migration Coordinator
 * Coordinates and executes multiple CloudSQL migrations in parallel or sequence
 */
class BatchMigrationCoordinator {
  constructor(dependencies = {}) {
    this.coordinator = dependencies.coordinator;
    this.logger = dependencies.logger;
    this.progressTracker = dependencies.progressTracker;
    this.validator = dependencies.validator;
    
    // Batch execution configuration
    this.maxParallel = dependencies.maxParallel || 3;
    this.stopOnError = dependencies.stopOnError !== false;
    this.retryFailed = dependencies.retryFailed !== false;
    
    // Execution state
    this.activeMigrations = new Map();
    this.completedMigrations = [];
    this.failedMigrations = [];
    this.pendingMigrations = [];
  }

  /**
   * Execute batch migration from mapping
   * @param {MigrationMapping} mapping - Migration mapping configuration
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<Object>} Batch execution results
   */
  async executeBatch(mapping, progressCallback) {
    const startTime = Date.now();
    
    // Validate mapping
    const validation = mapping.validate();
    if (!validation.valid) {
      throw new Error(`Invalid mapping: ${validation.errors.join(', ')}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warning => {
        this.logger?.warn(`Mapping warning: ${warning}`);
      });
    }

    // Generate execution plan
    const tasks = mapping.generateExecutionPlan();
    this.logger?.info(`Batch migration started: ${tasks.length} migrations planned`);
    
    // Initialize execution state
    const batchState = new ExecutionState({
      metadata: {
        toolName: 'batch-migration',
        totalTasks: tasks.length,
        strategy: mapping.strategy,
        mappingType: mapping.metadata.mappingType
      }
    });

    batchState.start(['Initialization', 'Validation', 'Execution', 'Consolidation', 'Reporting']);
    
    try {
      // Phase 1: Initialization
      batchState.setCurrentPhase('Initialization');
      progressCallback?.({
        phase: 'Initialization',
        current: 0,
        total: tasks.length,
        status: 'Preparing batch migration'
      });

      // Convert tasks to operation configs
      const operations = this._createOperations(tasks, mapping);
      this.pendingMigrations = [...operations];

      // Phase 2: Validation
      batchState.setCurrentPhase('Validation');
      progressCallback?.({
        phase: 'Validation',
        current: 0,
        total: tasks.length,
        status: 'Validating all migrations'
      });

      await this._validateAllOperations(operations);

      // Phase 3: Execution
      batchState.setCurrentPhase('Execution');
      const results = await this._executeOperations(operations, progressCallback, batchState);

      // Phase 4: Consolidation (if needed for N:1 mappings)
      if (mapping.metadata.mappingType === 'N:1' && mapping.conflictResolution === 'merge') {
        batchState.setCurrentPhase('Consolidation');
        progressCallback?.({
          phase: 'Consolidation',
          current: results.successful.length,
          total: tasks.length,
          status: 'Consolidating databases'
        });

        await this._consolidateDatabases(results, mapping);
      }

      // Phase 5: Reporting
      batchState.setCurrentPhase('Reporting');
      const report = this._generateReport(results, mapping, startTime);
      
      batchState.complete(report);
      
      progressCallback?.({
        phase: 'Complete',
        current: tasks.length,
        total: tasks.length,
        status: `Batch migration completed: ${results.successful.length}/${tasks.length} successful`
      });

      return report;

    } catch (error) {
      batchState.fail(error);
      throw error;
    }
  }

  /**
   * Create operation configs from tasks
   * @private
   */
  _createOperations(tasks, mapping) {
    return tasks.map((task, index) => {
      const config = new OperationConfig({
        source: {
          project: task.source.project,
          instance: task.source.instance,
          databases: Array.isArray(task.databases) ? task.databases : 
                   task.databases === 'all' ? null : 
                   task.databases?.split(',').map(d => d.trim()),
          user: task.source.user || 'postgres',
          password: task.source.password,
          ip: task.source.ip
        },
        target: {
          project: task.target.project,
          instance: task.target.instance,
          user: task.target.user || 'postgres',
          password: task.target.password,
          ip: task.target.ip
        },
        options: {
          ...mapping.options, // Include all options from mapping first
          includeAll: task.databases === 'all' || task.includeAll,
          conflictResolution: task.conflictResolution,
          prefixWith: task.prefixWith
        },
        metadata: {
          toolName: 'gcp.cloudsql.migrate',
          batchId: `batch_${Date.now()}`,
          taskIndex: index,
          totalTasks: tasks.length,
          strategy: mapping.strategy,
          mappingType: mapping.metadata.mappingType
        }
      });

      return {
        id: `migration_${index}_${task.source.instance}_to_${task.target.instance}`,
        config,
        task
      };
    });
  }

  /**
   * Validate all operations before execution
   * @private
   */
  async _validateAllOperations(operations) {
    const validationPromises = operations.map(async (op) => {
      try {
        const tool = this.coordinator.getTool('gcp.cloudsql.migrate');
        const validation = await tool.validate(op.config);
        return { id: op.id, valid: validation.isValid, error: null };
      } catch (error) {
        return { id: op.id, valid: false, error: error.message };
      }
    });

    const validations = await Promise.all(validationPromises);
    const failures = validations.filter(v => !v.valid);

    if (failures.length > 0) {
      const errorMessages = failures.map(f => `${f.id}: ${f.error}`).join('\n');
      throw new Error(`Validation failed for ${failures.length} migrations:\n${errorMessages}`);
    }

    this.logger?.info('All migrations validated successfully');
  }

  /**
   * Execute operations with concurrency control
   * @private
   */
  async _executeOperations(operations, progressCallback, batchState) {
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    let completed = 0;
    const total = operations.length;

    // Execute with concurrency limit
    const executeWithLimit = async () => {
      const executing = [];

      for (const operation of operations) {
        // Wait if we've reached the parallel limit
        if (executing.length >= this.maxParallel) {
          await Promise.race(executing);
        }

        const promise = this._executeSingleOperation(operation)
          .then(result => {
            completed++;
            results.successful.push(result);
            
            progressCallback?.({
              phase: 'Execution',
              current: completed,
              total,
              status: `Completed ${operation.id}`,
              details: {
                successful: results.successful.length,
                failed: results.failed.length
              }
            });

            // Update batch state metrics
            batchState.updateMetrics({
              completed,
              successful: results.successful.length,
              failed: results.failed.length
            });

            // Remove from executing array
            const index = executing.indexOf(promise);
            if (index > -1) {
              executing.splice(index, 1);
            }
          })
          .catch(error => {
            completed++;
            results.failed.push({
              operation,
              error: error.message,
              stack: error.stack
            });

            this.logger?.error(`Migration failed: ${operation.id}`, error);

            progressCallback?.({
              phase: 'Execution',
              current: completed,
              total,
              status: `Failed ${operation.id}: ${error.message}`,
              details: {
                successful: results.successful.length,
                failed: results.failed.length
              }
            });

            // Update batch state metrics
            batchState.updateMetrics({
              completed,
              successful: results.successful.length,
              failed: results.failed.length
            });

            // Check if should stop on error
            if (this.stopOnError) {
              // Mark this as a critical failure that should stop execution
              const stopError = new Error(`Stopping batch execution due to failure in ${operation.id}: ${error.message}`);
              stopError.stopExecution = true;
              throw stopError;
            }

            // Remove from executing array
            const index = executing.indexOf(promise);
            if (index > -1) {
              executing.splice(index, 1);
            }
          });

        executing.push(promise);
      }

      // Wait for remaining operations
      await Promise.allSettled(executing);
    };

    try {
      await executeWithLimit();
    } catch (error) {
      if (this.stopOnError && error?.stopExecution) {
        // Mark remaining operations as skipped
        const executedIds = new Set([
          ...results.successful.map(r => r.operation.id),
          ...results.failed.map(r => r.operation.id)
        ]);

        operations.forEach(op => {
          if (!executedIds.has(op.id)) {
            results.skipped.push(op);
          }
        });

        this.logger?.warn(`Batch execution stopped: ${results.skipped.length} migrations skipped`);
        
        // Re-throw the error to propagate to caller when stopOnError is true
        throw error;
      }
    }

    // Retry failed migrations if configured
    if (this.retryFailed && results.failed.length > 0) {
      this.logger?.info(`Retrying ${results.failed.length} failed migrations`);
      
      const retryResults = await this._retryFailedOperations(
        results.failed.map(f => f.operation),
        progressCallback
      );

      // Move successful retries from failed to successful
      retryResults.successful.forEach(success => {
        const failedIndex = results.failed.findIndex(
          f => f.operation.id === success.operation.id
        );
        if (failedIndex > -1) {
          results.failed.splice(failedIndex, 1);
          results.successful.push(success);
        }
      });
    }

    return results;
  }

  /**
   * Execute a single migration operation
   * @private
   */
  async _executeSingleOperation(operation) {
    const startTime = Date.now();
    
    this.logger?.info(`Starting migration: ${operation.id}`);
    this.activeMigrations.set(operation.id, {
      startTime,
      operation
    });

    try {
      const result = await this.coordinator.execute(
        'gcp.cloudsql.migrate',
        operation.config
      );

      const duration = Date.now() - startTime;
      
      this.activeMigrations.delete(operation.id);
      this.completedMigrations.push({
        operation,
        result,
        duration,
        success: true
      });

      this.logger?.info(`Migration completed: ${operation.id} (${duration}ms)`);

      return {
        operation,
        result,
        duration,
        success: true
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.activeMigrations.delete(operation.id);
      this.failedMigrations.push({
        operation,
        error,
        duration
      });

      throw error;
    }
  }

  /**
   * Retry failed operations
   * @private
   */
  async _retryFailedOperations(operations, progressCallback) {
    const results = {
      successful: [],
      failed: []
    };

    for (const operation of operations) {
      try {
        this.logger?.info(`Retrying migration: ${operation.id}`);
        
        progressCallback?.({
          phase: 'Retry',
          status: `Retrying ${operation.id}`
        });

        const result = await this._executeSingleOperation(operation);
        results.successful.push(result);
        
      } catch (error) {
        results.failed.push({
          operation,
          error: error.message
        });
        this.logger?.error(`Retry failed: ${operation.id}`, error);
      }
    }

    return results;
  }

  /**
   * Consolidate databases for N:1 migrations with merge strategy
   * @private
   */
  async _consolidateDatabases(results, mapping) {
    if (mapping.conflictResolution !== 'merge') {
      return;
    }

    // Group successful migrations by target
    const byTarget = new Map();
    
    results.successful.forEach(result => {
      const targetKey = `${result.operation.config.target.project}:${result.operation.config.target.instance}`;
      
      if (!byTarget.has(targetKey)) {
        byTarget.set(targetKey, []);
      }
      
      byTarget.get(targetKey).push(result);
    });

    // For each target with multiple sources, handle database consolidation
    for (const [targetKey, migrations] of byTarget.entries()) {
      if (migrations.length > 1) {
        this.logger?.info(`Consolidating databases for target: ${targetKey}`);
        
        // Collect all database names
        const allDatabases = new Map();
        
        migrations.forEach(migration => {
          const databases = migration.result.migratedDatabases || [];
          databases.forEach(db => {
            if (!allDatabases.has(db)) {
              allDatabases.set(db, []);
            }
            allDatabases.get(db).push(migration.operation.config.source.instance);
          });
        });

        // Log consolidation summary
        allDatabases.forEach((sources, dbName) => {
          if (sources.length > 1) {
            this.logger?.warn(
              `Database "${dbName}" was migrated from multiple sources: ${sources.join(', ')}`
            );
          }
        });
      }
    }
  }

  /**
   * Generate execution report
   * @private
   */
  _generateReport(results, mapping, startTime) {
    const duration = Date.now() - startTime;
    const totalTasks = results.successful.length + results.failed.length + results.skipped.length;

    const report = {
      summary: {
        strategy: mapping.strategy,
        mappingType: mapping.metadata.mappingType,
        totalTasks,
        successful: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        duration,
        durationFormatted: this._formatDuration(duration),
        successRate: totalTasks > 0 ? 
          ((results.successful.length / totalTasks) * 100).toFixed(2) + '%' : '0%'
      },
      successful: results.successful.map(r => ({
        id: r.operation.id,
        source: `${r.operation.config.source.project}:${r.operation.config.source.instance}`,
        target: `${r.operation.config.target.project}:${r.operation.config.target.instance}`,
        databases: r.result.migratedDatabases || [],
        duration: r.duration,
        durationFormatted: this._formatDuration(r.duration)
      })),
      failed: results.failed.map(f => ({
        id: f.operation.id,
        source: `${f.operation.config.source.project}:${f.operation.config.source.instance}`,
        target: `${f.operation.config.target.project}:${f.operation.config.target.instance}`,
        error: f.error,
        duration: f.duration
      })),
      skipped: results.skipped.map(s => ({
        id: s.id,
        source: `${s.config.source.project}:${s.config.source.instance}`,
        target: `${s.config.target.project}:${s.config.target.instance}`,
        reason: 'Skipped due to previous failure'
      })),
      metadata: {
        executedAt: new Date().toISOString(),
        coordinator: 'BatchMigrationCoordinator',
        maxParallel: this.maxParallel,
        stopOnError: this.stopOnError,
        retryFailed: this.retryFailed
      }
    };

    // Add performance metrics
    if (results.successful.length > 0) {
      const durations = results.successful.map(r => r.duration);
      report.performance = {
        avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        totalDuration: duration
      };
    }

    return report;
  }

  /**
   * Format duration in human-readable format
   * @private
   */
  _formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  /**
   * Cancel active migrations
   */
  async cancelBatch() {
    this.logger?.warn('Cancelling batch migration');
    
    // Implementation would depend on ability to cancel individual migrations
    // For now, just clear the active migrations tracking
    this.activeMigrations.clear();
    
    return {
      cancelled: true,
      completed: this.completedMigrations.length,
      failed: this.failedMigrations.length
    };
  }

  /**
   * Get current batch status
   */
  getStatus() {
    return {
      active: this.activeMigrations.size,
      completed: this.completedMigrations.length,
      failed: this.failedMigrations.length,
      pending: this.pendingMigrations.length,
      activeMigrations: Array.from(this.activeMigrations.entries()).map(([id, data]) => ({
        id,
        startTime: data.startTime,
        duration: Date.now() - data.startTime
      }))
    };
  }
}

export default BatchMigrationCoordinator;