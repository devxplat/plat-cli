import { spawn } from 'child_process';
import path from 'path';
import { promises as fs } from 'fs';
import os from 'os';

class DatabaseOperations {
  constructor(connectionManager, logger) {
    this.connectionManager = connectionManager;
    this.logger = logger;
    this.tempDir = path.join(os.tmpdir(), 'plat-cli');
  }

  /**
   * Initialize temporary directory for backups
   */
  async init() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      this.logger.debug(`Diretório temporário criado: ${this.tempDir}`);
    } catch (error) {
      throw new Error(`Falha ao criar diretório temporário: ${error.message}`);
    }
  }

  /**
   * Export database using pg_dump
   */
  async exportDatabase(sourceProject, sourceInstance, database, options = {}) {
    const backupFile = path.join(
      this.tempDir,
      `${database}_${Date.now()}.backup`
    );

    try {
      this.logger.logDatabaseOperation('EXPORT INICIADO', database, {
        source: `${sourceProject}:${sourceInstance}`,
        backupFile
      });

      // Get connection config for SOURCE
      const config = await this.connectionManager.createConnectionConfig(
        sourceProject,
        sourceInstance,
        database,
        true, // isSource = true
        options.connectionInfo || {} // Pass connection info (ip, user, password)
      );

      // Build pg_dump command
      const pgDumpArgs = [
        '--host',
        config.host,
        '--port',
        config.port.toString(),
        '--username',
        config.user,
        '--dbname',
        database,
        '--verbose',
        '--format=custom',
        '--compress=9',
        '--no-password',
        '--file',
        backupFile
      ];

      // Add additional options
      if (options.schemaOnly) {
        pgDumpArgs.push('--schema-only');
      }

      if (options.dataOnly) {
        pgDumpArgs.push('--data-only');
      }

      if (options.excludeTableData && options.excludeTableData.length > 0) {
        options.excludeTableData.forEach((table) => {
          pgDumpArgs.push('--exclude-table-data', table);
        });
      }

      // Set environment variables for authentication
      const env = {
        ...process.env,
        PGPASSWORD: config.password
      };

      // Execute pg_dump
      const { stats } = await this._executeCommand('pg_dump', pgDumpArgs, env);

      // Verify backup file was created
      const backupStats = await fs.stat(backupFile);

      this.logger.logDatabaseOperation('EXPORT CONCLUÍDO', database, {
        backupFile,
        sizeBytes: backupStats.size,
        sizeFormatted: this._formatBytes(backupStats.size),
        duration: stats.duration
      });

      return {
        database,
        backupFile,
        size: backupStats.size,
        duration: stats.duration
      };
    } catch (error) {
      this.logger.error(`Falha no export de ${database}:`, error.message);

      // Clean up failed backup file
      try {
        await fs.unlink(backupFile);
      } catch (unlinkError) {
        this.logger.debug(
          `Não foi possível remover arquivo de backup falho: ${unlinkError.message}`
        );
      }

      throw error;
    }
  }

  /**
   * Import database using pg_restore
   */
  async importDatabase(
    targetProject,
    targetInstance,
    database,
    backupFile,
    options = {}
  ) {
    try {
      this.logger.logDatabaseOperation('IMPORT INICIADO', database, {
        target: `${targetProject}:${targetInstance}`,
        backupFile
      });

      // Check if backup file exists
      await fs.access(backupFile);

      // Create database if it doesn't exist
      if (options.createDatabase !== false) {
        await this._createDatabaseIfNotExists(
          targetProject,
          targetInstance,
          database,
          options.connectionInfo || {} // Pass connection info
        );
      }

      // Get connection config for TARGET
      const config = await this.connectionManager.createConnectionConfig(
        targetProject,
        targetInstance,
        database,
        false, // isSource = false
        options.connectionInfo || {} // Pass connection info (ip, user, password)
      );

      // Build pg_restore command
      const pgRestoreArgs = [
        '--host',
        config.host,
        '--port',
        config.port.toString(),
        '--username',
        config.user,
        '--dbname',
        database,
        '--verbose',
        '--no-password',
        '--clean',
        '--if-exists'
      ];

      // Add additional options
      if (options.dataOnly) {
        pgRestoreArgs.push('--data-only');
      }

      if (options.schemaOnly) {
        pgRestoreArgs.push('--schema-only');
      }

      // Note: --create and --single-transaction cannot be used together
      // We use --create for database creation but skip --single-transaction
      // The database is created separately via _createDatabaseIfNotExists
      if (options.singleTransaction && !options.createDatabase) {
        pgRestoreArgs.push('--single-transaction');
      }

      if (options.jobs && options.jobs > 1) {
        pgRestoreArgs.push('--jobs', options.jobs.toString());
      }

      // Add backup file as last argument
      pgRestoreArgs.push(backupFile);

      // Set environment variables for authentication
      const env = {
        ...process.env,
        PGPASSWORD: config.password
      };

      // Execute pg_restore
      const { stats } = await this._executeCommand(
        'pg_restore',
        pgRestoreArgs,
        env
      );

      this.logger.logDatabaseOperation('IMPORT CONCLUÍDO', database, {
        duration: stats.duration,
        target: `${targetProject}:${targetInstance}`
      });

      return {
        database,
        duration: stats.duration
      };
    } catch (error) {
      this.logger.error(`Falha no import de ${database}:`, error.message);
      throw error;
    }
  }

  /**
   * Validate database compatibility between source and target
   * @deprecated This method is only used in tests. Use migration-engine for production.
   */
  async validateCompatibility(
    sourceProject,
    sourceInstance,
    targetProject,
    targetInstance,
    sourceConnectionInfo = {},
    targetConnectionInfo = {}
  ) {
    try {
      this.logger.info('🔍 Validando compatibilidade entre instâncias...');

      // Test connections - now with proper parameters
      const sourceTest = await this.connectionManager.testConnection(
        sourceProject,
        sourceInstance,
        'postgres', // default database
        true, // isSource
        sourceConnectionInfo
      );
      const targetTest = await this.connectionManager.testConnection(
        targetProject,
        targetInstance,
        'postgres', // default database
        false, // isSource = false for target
        targetConnectionInfo
      );

      if (!sourceTest.success) {
        throw new Error(
          `Falha ao conectar com instância origem: ${sourceTest.error}`
        );
      }

      if (!targetTest.success) {
        throw new Error(
          `Falha ao conectar com instância destino: ${targetTest.error}`
        );
      }

      // Compare PostgreSQL versions
      const sourceVersion = this._parseVersion(sourceTest.version);
      const targetVersion = this._parseVersion(targetTest.version);

      const compatibility = {
        compatible: true,
        warnings: [],
        sourceVersion: sourceTest.version,
        targetVersion: targetTest.version
      };

      // Check version compatibility
      if (sourceVersion.major > targetVersion.major) {
        compatibility.compatible = false;
        compatibility.warnings.push(
          `Versão origem (${sourceTest.version}) é mais nova que destino (${targetTest.version}). Pode haver problemas de compatibilidade.`
        );
      } else if (sourceVersion.major < targetVersion.major) {
        compatibility.warnings.push(
          `Migração de versão mais antiga (${sourceTest.version}) para mais nova (${targetTest.version}). Recomendamos testar antes da migração completa.`
        );
      }

      // Log compatibility results
      if (compatibility.compatible) {
        this.logger.info('✅ Instâncias são compatíveis', {
          source: sourceTest.version,
          target: targetTest.version
        });
      } else {
        this.logger.warn(
          '⚠️ Possível incompatibilidade detectada',
          compatibility.warnings
        );
      }

      return compatibility;
    } catch (error) {
      this.logger.error('Erro na validação de compatibilidade:', error.message);
      throw error;
    }
  }

  /**
   * Get database size information
   */
  async getDatabaseSize(project, instance, database, connectionInfo = {}) {
    try {
      // Use connect instead of query to pass connectionInfo
      const pool = await this.connectionManager.connect(
        project,
        instance,
        database,
        connectionInfo.isSource,
        connectionInfo
      );
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          `SELECT 
            pg_database_size(current_database()) as size_bytes,
            count(*) as table_count
          FROM information_schema.tables 
          WHERE table_schema = 'public'`
        );
        
        const sizeBytes = parseInt(result.rows[0].size_bytes, 10);
        const tableCount = parseInt(result.rows[0].table_count, 10);

        return {
          database,
          sizeBytes,
          sizeFormatted: this._formatBytes(sizeBytes),
          tableCount
        };
      } finally {
        client.release();
      }
    } catch (error) {
      this.logger.warn(
        `Não foi possível obter tamanho do banco ${database}:`,
        error.message
      );
      return {
        database,
        sizeBytes: 0,
        sizeFormatted: 'Unknown',
        tableCount: 0
      };
    }
  }

  /**
   * Get migration time estimate for a list of databases
   */
  async getMigrationEstimate(
    sourceProject,
    sourceInstance,
    databases,
    options = {}
  ) {
    try {
      const estimateResults = {
        databases: [],
        totalSizeBytes: 0,
        estimatedDurationMinutes: 0,
        estimatedSpeed: '50 MB/min', // Default heuristic
        factors: []
      };

      // Get size information for each database
      for (const dbName of databases) {
        const dbInfo = await this.getDatabaseSize(
          sourceProject,
          sourceInstance,
          dbName,
          { ...options.connectionInfo, isSource: true } // Pass connectionInfo with isSource flag
        );
        estimateResults.databases.push(dbInfo);
        estimateResults.totalSizeBytes += dbInfo.sizeBytes;
      }

      // Calculate time estimate based on heuristics
      estimateResults.estimatedDurationMinutes = this._calculateTimeEstimate(
        estimateResults.totalSizeBytes,
        options
      );

      // Add factors that affect migration time
      estimateResults.factors = this._getEstimateFactors(options);

      return estimateResults;
    } catch (error) {
      this.logger.warn(`Erro ao calcular estimativa: ${error.message}`);
      return {
        databases: [],
        totalSizeBytes: 0,
        estimatedDurationMinutes: 30, // Conservative fallback
        estimatedSpeed: 'Unknown',
        factors: ['Unable to calculate precise estimate']
      };
    }
  }

  /**
   * Calculate time estimate based on database size and migration options
   * Returns time in minutes
   */
  _calculateTimeEstimate(totalSizeBytes, options = {}) {
    // Base speeds in MB/minute (conservative estimates)
    const baseSpeeds = {
      schemaOnly: 500, // Schema migrations are fast
      dataOnly: 50, // Data is slower, depends on network and constraints
      full: 40, // Full migrations include both + indexes + constraints
      withIndexes: 25, // Rebuilding indexes is expensive
      compressed: 80 // Compression helps but adds CPU overhead
    };

    let speedMBPerMin = baseSpeeds.full; // Default

    // Adjust speed based on migration type
    if (options.schemaOnly) {
      speedMBPerMin = baseSpeeds.schemaOnly;
    } else if (options.dataOnly) {
      speedMBPerMin = baseSpeeds.dataOnly;
    }

    // Factor in additional complexities
    if (options.includeIndexes !== false) {
      speedMBPerMin = Math.min(speedMBPerMin, baseSpeeds.withIndexes);
    }

    if (options.compress) {
      speedMBPerMin = baseSpeeds.compressed;
    }

    // Network latency factor (between Cloud SQL instances)
    if (options.crossRegion) {
      speedMBPerMin *= 0.7; // 30% slower for cross-region
    }

    // Large database factor (parallel processing becomes less efficient)
    const sizeMB = totalSizeBytes / (1024 * 1024);
    if (sizeMB > 10240) {
      // > 10GB
      speedMBPerMin *= 0.8; // 20% slower for very large databases
    }

    // Calculate estimated time
    const estimatedMinutes = Math.ceil(sizeMB / speedMBPerMin);

    // Add overhead for setup/teardown (minimum 2 minutes, max 15% overhead)
    const overhead = Math.min(Math.max(2, estimatedMinutes * 0.15), 30);

    return estimatedMinutes + overhead;
  }

  /**
   * Get factors that affect migration time for user information
   */
  _getEstimateFactors(options = {}) {
    const factors = [];

    if (options.schemaOnly) {
      factors.push('Schema-only migration (faster)');
    } else if (options.dataOnly) {
      factors.push('Data-only migration');
    } else {
      factors.push('Full migration (schema + data + indexes)');
    }

    if (options.compress) {
      factors.push('Compression enabled (better network, more CPU)');
    }

    if (options.crossRegion) {
      factors.push('Cross-region migration (network latency)');
    }

    if (!options.includeIndexes) {
      factors.push('Indexes excluded (faster)');
    }

    factors.push('Estimates based on typical Cloud SQL performance');

    return factors;
  }

  /**
   * Clean up temporary files
   */
  async cleanup() {
    try {
      const files = await fs.readdir(this.tempDir);

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        await fs.unlink(filePath);
        this.logger.debug(`Arquivo temporário removido: ${filePath}`);
      }

      await fs.rmdir(this.tempDir);
      this.logger.info(
        `🧹 Limpeza concluída: ${files.length} arquivos removidos`
      );
    } catch (error) {
      this.logger.warn(
        'Erro na limpeza de arquivos temporários:',
        error.message
      );
    }
  }

  // Private methods

  async _createDatabaseIfNotExists(project, instance, database, connectionInfo = {}) {
    try {
      // Connect to postgres database to create new database
      const pool = await this.connectionManager.connect(
        project,
        instance,
        'postgres',
        false, // isSource = false (target)
        connectionInfo // Pass connection info
      );
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          'SELECT 1 FROM pg_database WHERE datname = $1',
          [database]
        );

        if (result.rows.length === 0) {
          this.logger.info(`📝 Criando banco de dados: ${database}`);
          await client.query(`CREATE DATABASE "${database}"`);
        }
      } finally {
        client.release();
      }
    } catch (error) {
      this.logger.warn(`Aviso ao criar banco ${database}:`, error.message);
      // Continue even if database creation fails - it might already exist
    }
  }

  async _executeCommand(command, args, env = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      this.logger.debug(`Executando comando: ${command} ${args.join(' ')}`);

      const childProcess = spawn(command, args, {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      childProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;

        // Log progress information from pg_dump/pg_restore
        if (output.includes('processing') || output.includes('dumping')) {
          this.logger.debug(output.trim());
        }
      });

      childProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;

        // pg_dump and pg_restore send progress info to stderr
        if (
          output.includes('processing') ||
          output.includes('dumping') ||
          output.includes('creating')
        ) {
          this.logger.debug(output.trim());
        }
      });

      childProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        const stats = { duration, code };

        if (code === 0) {
          resolve({ stdout, stderr, stats });
        } else {
          reject(
            new Error(`Comando ${command} falhou com código ${code}: ${stderr}`)
          );
        }
      });

      childProcess.on('error', (error) => {
        reject(new Error(`Erro ao executar ${command}: ${error.message}`));
      });
    });
  }

  _parseVersion(versionString) {
    const match = versionString.match(/(\d+)\.?(\d+)?/);
    if (match) {
      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2] || '0', 10)
      };
    }
    return { major: 0, minor: 0 };
  }

  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default DatabaseOperations;
