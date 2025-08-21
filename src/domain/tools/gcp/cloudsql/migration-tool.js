import ITool from '../../../interfaces/tool-interface.js';

/**
 * GCP CloudSQL Migration Tool
 * Handles PostgreSQL database migrations between CloudSQL instances
 */
class CloudSQLMigrationTool extends ITool {
  static get metadata() {
    return {
      name: 'gcp.cloudsql.migrate',
      version: '1.0.0',
      description: 'Migrate PostgreSQL databases between CloudSQL instances',
      category: 'migration',
      provider: 'gcp',
      service: 'cloudsql'
    };
  }

  constructor(dependencies = {}) {
    super();
    this.connectionManager = dependencies.connectionManager;
    this.databaseOps = dependencies.databaseOps;
    this.migrationEngine = dependencies.migrationEngine;
    this.logger = dependencies.logger;
  }

  /**
   * Validate configuration for CloudSQL migration
   */
  async validate(config) {
    // Use OperationConfig validation if available, otherwise basic validation
    if (config && typeof config.validate === 'function') {
      const validation = config.validate();
      if (!validation.valid) {
        throw new Error(
          `Configuration validation failed: ${validation.errors.join(', ')}`
        );
      }
    } else {
      // Basic validation for plain objects
      if (!config || typeof config !== 'object') {
        throw new Error('Configuration must be an object');
      }
      if (!config.source || !config.target) {
        throw new Error('Configuration must have source and target');
      }
    }

    // Test source connectivity
    try {
      await this.connectionManager.testConnection(
        config.source.project,
        config.source.instance,
        'postgres',
        true, // isSource
        config.source // Pass source connection info (ip, user, password)
      );
    } catch (error) {
      throw new Error(`Source connection failed: ${error.message}`);
    }

    // Test target connectivity (skip for dry runs)
    if (!config.options.dryRun) {
      try {
        await this.connectionManager.testConnection(
          config.target.project,
          config.target.instance,
          'postgres',
          false, // isSource
          config.target // Pass target connection info (ip, user, password)
        );
      } catch (error) {
        throw new Error(`Target connection failed: ${error.message}`);
      }
    }

    // Validate database selection
    if (config.options.includeAll) {
      const databases = await this.connectionManager.listDatabases(
        config.source.project,
        config.source.instance,
        true, // isSource
        config.source // Pass source connection info
      );

      if (databases.length === 0) {
        throw new Error('No databases found in source instance');
      }
      
      this.logger.info(`Will migrate all databases from source (${databases.length} databases found)`);
    } else if (config.source.databases && config.source.databases.length > 0) {
      // Verify specified databases exist
      const databases = await this.connectionManager.listDatabases(
        config.source.project,
        config.source.instance,
        true, // isSource
        config.source // Pass source connection info
      );

      const dbNames = databases.map((db) => db.name);
      const missingDbs = config.source.databases.filter(
        (db) => !dbNames.includes(db)
      );

      if (missingDbs.length > 0) {
        throw new Error(`Databases not found: ${missingDbs.join(', ')}`);
      }
      
      this.logger.info(`Will migrate specific databases: ${config.source.databases.join(', ')}`);
    } else {
      // Neither includeAll nor specific databases provided
      throw new Error('Database selection required: either set includeAll to true or specify databases to migrate');
    }

    // Return validation success
    return { isValid: true };
  }

  /**
   * Execute CloudSQL migration
   */
  async execute(config, progressCallback) {
    // Check if batch migration
    if (config.isBatch && config.mapping) {
      return await this.executeBatch(config.mapping, progressCallback);
    }

    const { default: ExecutionState } = await import(
      '../../../models/execution-state.js'
    );
    const state = new ExecutionState(config);

    const phases = [
      'Validation',
      'Discovery',
      'Pre-flight Checks',
      'Export',
      'Import',
      'Post-migration Validation',
      'Cleanup'
    ];

    state.start(phases);

    try {
      // Phase 1: Validation
      state.setCurrentPhase('Validation');
      progressCallback &&
        progressCallback({
          phase: 'Validation',
          current: 0,
          total: 100,
          status: 'Validating configuration and connections'
        });
      await this.validate(config);

      // Phase 2: Discovery
      state.setCurrentPhase('Discovery');
      progressCallback &&
        progressCallback({
          phase: 'Discovery',
          current: 20,
          total: 100,
          status: 'Discovering databases to migrate'
        });

      let databasesToMigrate;
      if (config.options.includeAll) {
        const allDatabases = await this.connectionManager.listDatabases(
          config.source.project,
          config.source.instance,
          true, // isSource
          config.source // Pass source connection info
        );
        databasesToMigrate = allDatabases.map((db) => db.name);
        this.logger.info(`Discovery: Found ${databasesToMigrate.length} databases to migrate (all databases)`);
      } else {
        databasesToMigrate = config.source.databases;
        this.logger.info(`Discovery: Will migrate ${databasesToMigrate.length} specific databases: ${databasesToMigrate.join(', ')}`);
      }
      
      // Validate that we have databases to migrate
      if (!databasesToMigrate || databasesToMigrate.length === 0) {
        throw new Error('No databases selected for migration');
      }

      // Phase 3: Pre-flight Checks
      state.setCurrentPhase('Pre-flight Checks');
      progressCallback &&
        progressCallback({
          phase: 'Pre-flight Checks',
          current: 40,
          total: 100,
          status: 'Running pre-flight checks'
        });

      const estimate = await this.getEstimate(config);
      state.updateMetrics({
        totalSize: estimate.totalSizeBytes,
        estimatedDuration: estimate.estimatedDurationMinutes * 60 * 1000
      });

      // If dry run, stop here
      if (config.options.dryRun) {
        progressCallback &&
          progressCallback({
            phase: 'Dry Run Complete',
            current: 100,
            total: 100,
            status: 'Dry run completed successfully'
          });

        const result = {
          databasesToMigrate,
          estimate,
          message: 'Dry run completed successfully'
        };
        state.complete(result);
        return result;
      }

      // Phase 4-7: Execute actual migration
      const migrationConfig = {
        source: config.source,
        target: config.target,
        options: config.options,
        databases: databasesToMigrate
      };

      const result = await this.migrationEngine.migrate(
        migrationConfig,
        (progress) => {
          state.updateMetrics(progress.metrics || {});
          state.setCurrentPhase(progress.phase || state.currentPhase);
          progressCallback &&
            progressCallback({
              phase: progress.phase || state.currentPhase,
              current: progress.current || 60,
              total: 100,
              status: progress.status || 'Processing migration',
              sizeBytes: progress.sizeBytes
            });
        }
      );

      state.complete(result);
      return result;
    } catch (error) {
      state.fail(error);
      throw error;
    }
  }

  /**
   * Execute batch migration
   */
  async executeBatch(mapping, progressCallback) {
    const { default: BatchMigrationCoordinator } = await import(
      '../../../../application/batch-migration-coordinator.js'
    );

    const batchCoordinator = new BatchMigrationCoordinator({
      coordinator: {
        execute: async (toolName, config) => {
          // Execute single migration
          return await this.execute(config, progressCallback);
        },
        getTool: async () => this,
        progressTracker: { update: progressCallback },
        validator: { validate: (config) => this.validate(config) }
      },
      logger: this.logger,
      maxParallel: mapping.options?.maxParallel || 3,
      stopOnError: mapping.options?.stopOnError !== false,
      retryFailed: mapping.options?.retryFailed !== false
    });

    return await batchCoordinator.executeBatch(mapping, progressCallback);
  }

  /**
   * Get migration estimate
   */
  async getEstimate(config) {
    let databasesToAnalyze = config.source.databases;

    if (config.options.includeAll) {
      const allDatabases = await this.connectionManager.listDatabases(
        config.source.project,
        config.source.instance,
        true, // isSource
        config.source // Pass source connection info
      );
      databasesToAnalyze = allDatabases.map((db) => db.name);
    }

    const migrationOptions = {
      schemaOnly: config.options.schemaOnly,
      dataOnly: config.options.dataOnly,
      includeIndexes: true,
      compress: false,
      crossRegion: config.source.project !== config.target.project,
      connectionInfo: config.source // Pass source connection info
    };

    return await this.databaseOps.getMigrationEstimate(
      config.source.project,
      config.source.instance,
      databasesToAnalyze,
      migrationOptions
    );
  }

  /**
   * Check if tool can handle the configuration
   */
  canHandle(config) {
    return (
      config.metadata?.toolName === 'gcp.cloudsql.migrate' ||
      (config.source?.project &&
        config.source?.instance &&
        config.target?.project &&
        config.target?.instance)
    );
  }

  /**
   * Get help information
   */
  getHelp() {
    return {
      description:
        'Migrate PostgreSQL databases between GCP CloudSQL instances',
      usage: 'plat-cli gcp cloudsql migrate [options]',
      options: [
        '--source-project <project>     GCP Project containing source instance',
        '--source-instance <instance>   Source CloudSQL instance name',
        '--target-project <project>     GCP Project for target instance',
        '--target-instance <instance>   Target CloudSQL instance name',
        '--databases <databases>        Comma-separated list of databases to migrate',
        '--include-all                  Migrate all databases in the instance',
        '--schema-only                  Migrate schema only (no data)',
        '--data-only                    Migrate data only (no schema)',
        '--dry-run                      Simulate migration without executing',
        '--retry-attempts <number>      Number of retry attempts (default: 3)',
        '--jobs <number>                Parallel jobs for pg_restore (default: 1)',
        '--force-compatibility          Skip version compatibility checks',
        '--strategy <strategy>          Migration strategy (auto-detected: simple, consolidate, distribute, replicate, version-based, round-robin, split-by-database, manual-mapping, custom)',
        '--conflict-resolution <method> Conflict resolution (fail, prefix, suffix, merge, rename-schema)',
        '--sources-file <file>          File with source instances for batch migration',
        '--mapping-file <file>          Migration mapping file for complex batch operations'
      ],
      examples: [
        {
          description: 'Migrate specific databases',
          command:
            'plat-cli gcp cloudsql migrate --source-project my-source --source-instance source-db --target-project my-target --target-instance target-db --databases app,analytics'
        },
        {
          description: 'Migrate all databases',
          command:
            'plat-cli gcp cloudsql migrate --source-project my-source --source-instance source-db --target-project my-target --target-instance target-db --include-all'
        },
        {
          description: 'Dry run migration',
          command:
            'plat-cli gcp cloudsql migrate --source-project my-source --source-instance source-db --target-project my-target --target-instance target-db --include-all --dry-run'
        },
        {
          description: 'Batch migration with custom strategy',
          command:
            'plat-cli gcp cloudsql migrate --sources-file instances.txt --target-project my-target --target-instance target-db --strategy consolidate --conflict-resolution prefix'
        },
        {
          description: 'Advanced batch migration with mapping file',
          command:
            'plat-cli gcp cloudsql migrate --mapping-file migrations.json --strategy version-based --dry-run'
        }
      ]
    };
  }
}

export default CloudSQLMigrationTool;
