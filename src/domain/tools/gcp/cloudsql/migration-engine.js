// Migration Engine - handles database migration operations
import UsersRolesExtractor from '../../../../infrastructure/cloud/gcp-users-roles-extractor.js';

class ModernMigrationEngine {
  constructor(logger, connectionManager, databaseOps, progressTracker) {
    this.logger = logger;
    this.connectionManager = connectionManager;
    this.databaseOps = databaseOps;
    this.progressTracker = progressTracker;
    this.usersRolesExtractor = new UsersRolesExtractor(connectionManager, logger);

    this.state = {
      id: null,
      status: 'pending',
      startTime: null,
      endTime: null,
      config: null,
      processedDatabases: [],
      errors: [],
      metrics: {
        totalDatabases: 0,
        processedDatabases: 0,
        totalSizeBytes: 0,
        processedSizeBytes: 0
      },
      databaseDetails: []
    };
  }

  /**
   * Execute migration with modern progress tracking
   */
  async migrate(config) {
    this.state.id = `migration_${Date.now()}`;
    this.state.config = config;
    this.state.startTime = Date.now();
    this.state.status = 'running';

    try {
      this.logger.logMigrationStart(config);

      // Initialize database operations
      await this.databaseOps.init();

      // Phase 1: Validation
      await this._executePhase('Validation', async () => {
        await this._validateConfiguration(config);
        this.progressTracker.status('Configuration validated', 'success');
      });

      // Phase 2: Discovery
      let databases;
      await this._executePhase('Discovery', async () => {
        databases = await this._discoverDatabases(config);
        this.state.metrics.totalDatabases = databases.length;
        this._updateTotalSize(databases);
        this.progressTracker.status(
          `Found ${databases.length} databases`,
          'success'
        );
      });

      if (databases.length === 0) {
        throw new Error('No databases found for migration');
      }

      // Phase 3: Pre-flight checks
      await this._executePhase('Pre-flight Checks', async () => {
        await this._preflightChecks(config, databases);
        this.progressTracker.status('All checks passed', 'success');
      });

      // Phase 3.5: Users & Roles Migration (Optional)
      let usersRolesScripts = null;
      let databasePermissions = null;
      if (config.options?.includeUsersRoles) {
        await this._executePhase('Users & Roles Setup', async () => {
          // Initialize extractor
          await this.usersRolesExtractor.init();
          
          // Extract users and roles from source
          // Check if specific users are selected
          const filterUsers = config.options?.userSelectionMode === 'specific' && config.options?.selectedUsers?.all
            ? config.options.selectedUsers.all
            : null;
            
          const extractedData = await this.usersRolesExtractor.extractUsersAndRoles(
            config.source.project,
            config.source.instance,
            config.source,
            filterUsers
          );
          
          // Extract database permissions for later use
          const dbNames = databases.map(db => db.name);
          databasePermissions = await this.usersRolesExtractor.extractDatabasePermissions(
            config.source.project,
            config.source.instance,
            dbNames,
            config.source
          );
          
          // Generate creation script
          const createScript = await this.usersRolesExtractor.generateCreateScript(
            extractedData,
            config.options.passwordStrategy || { type: 'default', defaultPassword: 'ChangeMeNow123!' }
          );
          
          // Apply users and roles to target
          const result = await this.usersRolesExtractor.applyUsersAndRoles(
            config.target.project,
            config.target.instance,
            createScript,
            config.target
          );
          
          this.progressTracker.status(
            `Users/Roles migrated: ${result.successCount} successful, ${result.errorCount} failed`,
            result.errorCount > 0 ? 'warning' : 'success'
          );
          
          usersRolesScripts = { createScript };
        });
      }

      // Phase 4: Export phase
      let backups;
      await this._executePhase('Export', async () => {
        backups = await this._exportPhase(databases);
        this.progressTracker.status(
          `${backups.length} databases exported`,
          'success'
        );
      });

      // Phase 5: Import phase
      await this._executePhase('Import', async () => {
        await this._importPhase(backups, config);
        this.progressTracker.status('All databases imported', 'success');
      });

      // Phase 5.5: Apply Permissions (Optional)
      if (config.options?.includeUsersRoles && databasePermissions) {
        await this._executePhase('Apply Permissions', async () => {
          const dbNames = databases.map(db => db.name);
          const permissionsScript = await this.usersRolesExtractor.generatePermissionsScript(
            databasePermissions,
            dbNames
          );
          
          // Apply permissions script to target
          await this.databaseOps.applyPermissionsScript(
            config.target.project,
            config.target.instance,
            permissionsScript,
            config.target
          );
          
          this.progressTracker.status('Permissions restored', 'success');
        });
      }

      // Phase 6: Post-migration validation
      await this._executePhase('Post-migration Validation', async () => {
        await this._postMigrationValidation(config, databases);
        this.progressTracker.status('Validation completed', 'success');
      });

      // Phase 7: Cleanup
      await this._executePhase('Cleanup', async () => {
        await this._cleanup();
        
        // Cleanup users/roles temp files if used
        if (config.options?.includeUsersRoles) {
          await this.usersRolesExtractor.cleanup();
        }
        
        this.progressTracker.status('Cleanup completed', 'success');
      });

      this.state.status = 'completed';
      this.state.endTime = Date.now();

      const duration = this.state.endTime - this.state.startTime;

      return {
        success: true,
        migrationId: this.state.id,
        duration,
        metrics: this.state.metrics,
        processedDatabases: this.state.processedDatabases.length,
        databases: this.state.processedDatabases,
        databaseDetails: this.state.databaseDetails || [],
        sourceInstance: `${config.source.project}/${config.source.instance}`,
        targetInstance: `${config.target.project}/${config.target.instance}`,
        successful: this.state.processedDatabases || [],
        failed: []
      };
    } catch (error) {
      this.state.status = 'failed';
      this.state.endTime = Date.now();
      
      // Store detailed error info
      const errorDetail = {
        timestamp: Date.now(),
        message: error.message,
        stack: error.stack,
        phase: this.progressTracker.currentPhase?.name || 'Unknown'
      };
      
      this.state.errors.push(errorDetail);
      
      this.logger.error('Migration failed:', {
        phase: errorDetail.phase,
        error: error.message,
        migrationId: this.state.id
      });

      // Attempt cleanup even after error
      try {
        this.logger.debug('Attempting cleanup after migration error');
        await this._cleanup();
      } catch (cleanupError) {
        this.logger.warn('Cleanup failed after migration error (non-critical)', {
          cleanupError: cleanupError.message
        });
      }

      throw error;
    }
  }

  async _executePhase(phaseName, phaseFunction) {
    this.progressTracker.startPhase(phaseName, 1);

    try {
      await phaseFunction();
      this.progressTracker.update(1);
      this.progressTracker.completePhase();
    } catch (error) {
      this.logger.error(`Error in phase '${phaseName}':`, {
        phase: phaseName,
        error: error.message,
        stack: error.stack
      });
      this.progressTracker.completePhase(`Failed: ${error.message}`);
      throw error;
    }
  }

  async _validateConfiguration(config) {
    // Validate source and target configurations
    this.logger.debug('Validating configuration', config);

    // Add actual validation logic here
    if (!config.source.project || !config.source.instance) {
      throw new Error('Source project and instance are required');
    }

    if (!config.target.project || !config.target.instance) {
      throw new Error('Target project and instance are required');
    }
  }

  async _discoverDatabases(config) {
    this.logger.debug('Discovering databases');

    const allDatabases = await this.connectionManager.listDatabases(
      config.source.project,
      config.source.instance,
      true, // isSource
      config.source // connectionInfo
    );

    // Filter databases if specific ones are requested
    let databases = allDatabases;
    if (!config.options.includeAll && config.source.databases) {
      const selectedDbs = new Set(config.source.databases);
      databases = allDatabases.filter((db) => selectedDbs.has(db.name));
    }

    // Filter out system databases
    databases = databases.filter(
      (db) => !['postgres', 'template0', 'template1'].includes(db.name)
    );

    return databases;
  }

  async _preflightChecks(config) {
    this.logger.debug('Running pre-flight checks');

    // Test source connection
    await this.connectionManager.testConnection(
      config.source.project,
      config.source.instance,
      'postgres',
      true, // isSource
      config.source // connectionInfo with ip, user, password
    );

    // Test target connection
    await this.connectionManager.testConnection(
      config.target.project,
      config.target.instance,
      'postgres',
      false, // isSource
      config.target // connectionInfo with ip, user, password
    );

    // Additional checks can be added here
  }

  async _exportPhase(databases) {
    this.progressTracker.startPhase('Export', databases.length);

    const backups = [];

    for (let i = 0; i < databases.length; i++) {
      const db = databases[i];

      try {
        this.logger.debug(`Starting export: ${db.name}`);
        
        // Update progress with current database being exported
        const sizeInfo = db.sizeFormatted || this._formatBytes(db.sizeBytes || 0);
        this.progressTracker.update(i, `Exporting ${db.name} (${sizeInfo})`, 0);
        
        // Start predictive progress for this database
        this.progressTracker.startPredictiveProgress('export', db.name, db.sizeBytes || 0);

        const backup = await this.databaseOps.exportDatabase(
          this.state.config.source.project,
          this.state.config.source.instance,
          db.name,
          {
            schemaOnly: this.state.config.options.schemaOnly,
            dataOnly: this.state.config.options.dataOnly,
            connectionInfo: this.state.config.source // Pass source connection info (ip, user, password)
          }
        );

        backups.push(backup);
        
        // Stop predictive progress after successful export
        this.progressTracker.stopPredictiveProgress();

        // Update progress after successful export
        this.progressTracker.update(i + 1, `Exported ${db.name}`, db.sizeBytes || 0);

        // Update database details
        this.state.databaseDetails.push({
          name: db.name,
          status: 'exported',
          originalSize: db.sizeBytes,
          sizeFormatted: db.sizeFormatted,
          backupFile: backup.backupFile
        });

        this.state.processedDatabases.push(db.name);
        this.state.metrics.processedSizeBytes += db.sizeBytes;
      } catch (error) {
        this.logger.error(`Export failed: ${db.name}`, {
          error: error.message
        });
        throw new Error(
          `Export failed for database ${db.name}: ${error.message}`
        );
      }
    }

    this.progressTracker.completePhase(`${backups.length} databases exported`);
    return backups;
  }

  async _importPhase(backups, config) {
    this.progressTracker.startPhase('Import', backups.length);

    for (let i = 0; i < backups.length; i++) {
      const backup = backups[i];

      try {
        this.logger.debug(`Starting import: ${backup.database}`);
        
        // Find the original database size for this backup
        const dbDetail = this.state.databaseDetails.find(d => d.name === backup.database);
        const sizeInfo = dbDetail ? ` (${dbDetail.sizeFormatted || this._formatBytes(dbDetail.originalSize || 0)})` : '';
        const dbSize = dbDetail ? (dbDetail.originalSize || 0) : 0;
        
        // Update progress with current database being imported
        this.progressTracker.update(i, `Importing ${backup.database}${sizeInfo}`, 0);
        
        // Start predictive progress for this database
        this.progressTracker.startPredictiveProgress('import', backup.database, dbSize);

        await this.databaseOps.importDatabase(
          config.target.project,
          config.target.instance,
          backup.database,
          backup.backupFile,
          {
            jobs: config.options.jobs,
            schemaOnly: config.options.schemaOnly,
            dataOnly: config.options.dataOnly,
            connectionInfo: config.target // Pass target connection info (ip, user, password)
          }
        );
        
        // Stop predictive progress after successful import
        this.progressTracker.stopPredictiveProgress();

        // Update progress after successful import
        this.progressTracker.update(i + 1, `Imported ${backup.database}`, dbSize);

        // Update database details
        if (dbDetail) {
          dbDetail.status = 'completed';
        }
      } catch (error) {
        this.logger.error(`Import failed: ${backup.database}`, {
          error: error.message
        });
        throw new Error(
          `Import failed for database ${backup.database}: ${error.message}`
        );
      }
    }

    this.progressTracker.completePhase(`${backups.length} databases imported`);
  }

  async _postMigrationValidation(config, databases) {
    this.logger.debug('Running post-migration validation');

    for (const db of databases) {
      try {
        this.logger.debug(`Validating connection to target database: ${db.name}`);
        await this.connectionManager.testConnection(
          config.target.project,
          config.target.instance,
          db.name,
          false, // isSource = false (target database)
          config.target // Pass target connection info (ip, user, password)
        );
        this.logger.debug(`✓ Database ${db.name} is accessible on target instance`);
      } catch (error) {
        this.logger.error(`Post-migration validation failed for database ${db.name}:`, {
          database: db.name,
          error: error.message
        });
        throw error;
      }
    }
  }

  async _cleanup() {
    this.logger.debug('Starting cleanup');

    try {
      // Cleanup temporary files, connections, etc.
      await this.connectionManager.closeAllConnections();
      this.logger.debug('All connections closed successfully');
      
      // Additional cleanup logic can be added here
    } catch (error) {
      // Log cleanup errors but don't fail the migration
      this.logger.warn('Cleanup warning (non-critical):', {
        error: error.message
      });
      // Don't throw - cleanup errors shouldn't fail a successful migration
    }
  }

  _updateTotalSize(databases) {
    this.state.metrics.totalSizeBytes = databases.reduce(
      (sum, db) => sum + db.sizeBytes,
      0
    );
  }

  _formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

export default ModernMigrationEngine;
