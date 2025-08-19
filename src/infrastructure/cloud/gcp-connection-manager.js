// Configuration managed by ConfigManager
import configManager from '../config/config-manager.js';

import { Pool } from 'pg';

class ConnectionManager {
  constructor(logger, config = null) {
    this.logger = logger;
    this.config = config || configManager;
    this.connections = new Map();
    this.retryAttempts = this.config.get('database.retryAttempts', 3);
    this.retryDelay = 1000; // Start with 1 second
    this.connectionTimeout = this.config.get(
      'database.connectionTimeout',
      30000
    );
  }

  /**
   * Create connection configuration for CloudSQL instance
   */
  async createConnectionConfig(
    project,
    instance,
    database = 'postgres',
    isSource = null,
    connectionInfo = {}
  ) {
    // For CloudSQL, we typically connect via Cloud SQL Proxy or public IP
    // connectionInfo can contain: ip, user, password, sslMode, useProxy
    
    // Debug log to see what we're receiving
    this.logger.debug(`Creating connection config for ${project}:${instance}:${database}`, {
      isSource,
      hasConnectionInfo: !!connectionInfo,
      hasPassword: !!connectionInfo.password,
      hasIp: !!connectionInfo.ip,
      hasUser: !!connectionInfo.user
    });

    // Determine which password to use based on isSource
    let password = connectionInfo.password;
    if (!password) {
      if (isSource === true) {
        password = process.env.PGPASSWORD_SOURCE || process.env.CLOUDSQL_SOURCE_PASSWORD;
      } else if (isSource === false) {
        password = process.env.PGPASSWORD_TARGET || process.env.CLOUDSQL_TARGET_PASSWORD;
      }
      // Fallback to generic PGPASSWORD only if specific ones not found
      if (!password) {
        password = process.env.PGPASSWORD;
      }
    }

    const config = {
      host: connectionInfo.ip || `${instance}.c.${project}.internal`, // Use provided IP or fallback to private IP format
      port: 5432,
      user: connectionInfo.user || process.env.PGUSER || 'postgres',
      password: password,
      database,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: this.connectionTimeout,
      idleTimeoutMillis: this.connectionTimeout,
      max: 10, // Maximum number of connections in pool
      min: 2 // Minimum number of connections in pool
    };

    // Validate required credentials
    if (!config.password) {
      const passwordHint = isSource === true 
        ? 'Use --source-password ou configure PGPASSWORD_SOURCE' 
        : isSource === false 
        ? 'Use --target-password ou configure PGPASSWORD_TARGET'
        : 'Use --password ou configure PGPASSWORD';
      throw new Error(
        `Password não definido. ${passwordHint}`
      );
    }

    // If using Cloud SQL Auth proxy, connect via localhost
    if (connectionInfo.useProxy || process.env.USE_CLOUD_SQL_PROXY === 'true') {
      config.host = 'localhost';
      config.port = this._getProxyPort(project, instance);
      config.ssl = false;
    }

    // If using public IP with SSL (when not using proxy)
    if (!connectionInfo.useProxy && process.env.USE_CLOUD_SQL_PROXY !== 'true') {
      let publicIp = connectionInfo.ip; // Use IP from config first

      // If no IP provided in config, try environment variables
      if (!publicIp) {
        // First, try to get instance-specific IP from environment variables
        // Format: CLOUDSQL_IP_<INSTANCE_NAME>=<IP_ADDRESS>
        const instanceIpKey = `CLOUDSQL_IP_${instance.replace(/-/g, '_').toUpperCase()}`;
        const instanceSpecificIp = process.env[instanceIpKey];

        if (instanceSpecificIp) {
          publicIp = instanceSpecificIp;
          this.logger.debug(
            `Usando IP específico da instância ${instance}: ${publicIp} (${instanceIpKey})`
          );
        }
        // Try to determine which IP to use based on isSource parameter
        else if (isSource === true && process.env.CLOUDSQL_SOURCE_IP) {
          publicIp = process.env.CLOUDSQL_SOURCE_IP;
          this.logger.debug(`Usando IP público SOURCE: ${publicIp}`);
        } else if (isSource === false && process.env.CLOUDSQL_TARGET_IP) {
          publicIp = process.env.CLOUDSQL_TARGET_IP;
          this.logger.debug(`Usando IP público TARGET: ${publicIp}`);
        } else {
          // Fallback: try to determine based on instance name or use available IP
          const sourceIp = process.env.CLOUDSQL_SOURCE_IP;
          const targetIp = process.env.CLOUDSQL_TARGET_IP;

          if (sourceIp && targetIp) {
            // If both IPs are configured, try to guess based on instance name
              if (
              instance.includes('v2') ||
              instance.includes('source') ||
              instance.includes('origem')
            ) {
              publicIp = sourceIp;
              this.logger.debug(
                `Auto-detectado IP SOURCE baseado no nome da instância: ${publicIp}`
              );
            } else {
              publicIp = targetIp;
              this.logger.debug(
                `Auto-detectado IP TARGET baseado no nome da instância: ${publicIp}`
              );
            }
          } else if (sourceIp) {
            publicIp = sourceIp;
            this.logger.debug(`Usando IP SOURCE disponível: ${publicIp}`);
          } else if (targetIp) {
            publicIp = targetIp;
            this.logger.debug(`Usando IP TARGET disponível: ${publicIp}`);
          }
        }
      }

      if (publicIp) {
        config.host = publicIp;

        // Configure SSL based on SSL_MODE
        const sslMode = connectionInfo.sslMode || process.env.CLOUDSQL_SSL_MODE || 'simple';

        switch (sslMode.toLowerCase()) {
          case 'disable':
            config.ssl = false;
            this.logger.debug('SSL desabilitado para conexão CloudSQL');
            break;

          case 'simple':
            // SSL simples - sem certificados específicos, validação relaxada
            config.ssl = {
              rejectUnauthorized: false
            };
            this.logger.debug(
              'Usando SSL simples (sem validação de certificados)'
            );
            break;

          case 'strict':
            // SSL com certificados específicos
            config.ssl = {
              rejectUnauthorized: true,
              ca: process.env.CLOUDSQL_SERVER_CA_CERT,
              key: process.env.CLOUDSQL_CLIENT_KEY,
              cert: process.env.CLOUDSQL_CLIENT_CERT
            };

            if (!config.ssl.ca || !config.ssl.key || !config.ssl.cert) {
              this.logger.warn(
                '⚠️ SSL_MODE=strict mas certificados não configurados. Mudando para SSL simples.'
              );
              config.ssl = { rejectUnauthorized: false };
            } else {
              this.logger.debug('Usando SSL com certificados específicos');
            }
            break;

          default:
            // Fallback para SSL simples
            config.ssl = { rejectUnauthorized: false };
            this.logger.debug(
              'SSL_MODE desconhecido, usando SSL simples como fallback'
            );
        }

        this.logger.debug(
          `Configuração de conexão: host=${publicIp}, ssl=${config.ssl ? 'habilitado' : 'desabilitado'}, modo=${sslMode}`
        );
      } else {
        this.logger.warn(
          '⚠️ USE_CLOUD_SQL_PROXY=false mas nenhum IP público configurado. Configure CLOUDSQL_SOURCE_IP e/ou CLOUDSQL_TARGET_IP'
        );
      }
    }

    return config;
  }

  /**
   * Connect to a PostgreSQL instance with retry logic
   */
  async connect(project, instance, database = 'postgres', isSource = null, connectionInfo = {}) {
    const connectionKey = `${project}:${instance}:${database}`;

    // Return existing connection if available
    if (this.connections.has(connectionKey)) {
      const pool = this.connections.get(connectionKey);
      try {
        // Test the connection
        const client = await pool.connect();
        client.release();
        return pool;
      } catch {
        // Connection is stale, remove it
        this.logger.warn(
          `Conexão existente inválida para ${connectionKey}, recriando...`
        );
        await this._closeConnection(connectionKey);
      }
    }

    // Create new connection with retry logic
    return await this._connectWithRetry(project, instance, database, isSource, connectionInfo);
  }

  /**
   * Connect with exponential backoff retry
   */
  async _connectWithRetry(project, instance, database, isSource = null, connectionInfo = {}) {
    const connectionKey = `${project}:${instance}:${database}`;
    let lastError;
    let config; // Declare config outside try block

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        this.logger.logConnectionAttempt(
          connectionKey,
          attempt,
          this.retryAttempts
        );

        config = await this.createConnectionConfig(
          project,
          instance,
          database,
          isSource,
          connectionInfo
        );
        const pool = new Pool(config);

        // Test the connection
        const client = await pool.connect();

        // Get PostgreSQL version
        const versionResult = await client.query('SELECT version()');
        const version = this._parsePostgreSQLVersion(
          versionResult.rows[0].version
        );

        client.release();

        // Store the connection
        this.connections.set(connectionKey, pool);

        this.logger.logConnectionSuccess(connectionKey, version);

        return pool;
      } catch (error) {
        lastError = error;
        
        // Log detailed error information (config is defined in the parent scope)
        const errorDetails = {
          host: config ? config.host : 'unknown',
          port: config ? config.port : 'unknown',
          user: config ? config.user : 'unknown',
          database: database,
          ssl: config && config.ssl ? 'enabled' : 'disabled',
          passwordProvided: config ? !!config.password : false,
          errorCode: error.code,
          errorMessage: error.message
        };
        
        this.logger.logConnectionError(
          connectionKey,
          error,
          attempt,
          this.retryAttempts
        );
        
        this.logger.debug('Connection error details:', errorDetails);

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          this.logger.logRetry('conexão', attempt, this.retryAttempts, delay);
          await this._sleep(delay);
        }
      }
    }
    
    // Enhanced error message with more details
    const errorMessage = [
      `Falha ao conectar com ${connectionKey} após ${this.retryAttempts} tentativas`,
      `Erro: ${lastError.message}`,
      lastError.code === 'ECONNREFUSED' ? 'Verifique se o IP está correto e se o CloudSQL permite conexões externas' : '',
      lastError.code === 'ENOTFOUND' ? 'Host não encontrado. Verifique o IP ou hostname' : '',
      lastError.message.includes('password') ? 'Verifique se a senha está correta' : '',
      lastError.message.includes('FATAL') ? 'Erro de autenticação PostgreSQL' : ''
    ].filter(Boolean).join('. ');

    throw new Error(errorMessage);
  }

  /**
   * Get list of databases in an instance
   */
  async listDatabases(project, instance, isSource = null, connectionInfo = {}) {
    const pool = await this.connect(project, instance, 'postgres', isSource, connectionInfo);
    const client = await pool.connect();

    try {
      // Lista de bancos de sistema que não devem ser migrados
      const systemDatabases = [
        // Bancos padrão do PostgreSQL
        'postgres',
        'template0',
        'template1',

        // Bancos específicos do CloudSQL
        'cloudsqladmin',
        'cloudsqlimport',
        'cloudsqlexport',

        // Outros bancos de sistema comuns
        'information_schema',
        'pg_catalog',
        'pg_toast',
        'pg_temp',

        // Bancos relacionados a extensões
        'cloudsql_fdw_test',
        'test'
      ];

      const excludeList = systemDatabases.map((db) => `'${db}'`).join(', ');

      const result = await client.query(`
        SELECT datname, pg_database_size(datname) as size_bytes
        FROM pg_database 
        WHERE datistemplate = false 
        AND datname NOT IN (${excludeList})
        AND datname NOT LIKE 'pg_%'
        AND datname NOT LIKE 'template%'
        AND datname NOT LIKE 'cloudsql%'
        ORDER BY datname
      `);

      const filteredDatabases = result.rows.map((row) => ({
        name: row.datname,
        sizeBytes: parseInt(row.size_bytes, 10),
        sizeFormatted: this._formatBytes(parseInt(row.size_bytes, 10))
      }));

      this.logger.debug(
        `Bancos encontrados após filtragem: ${filteredDatabases.map((db) => db.name).join(', ')}`
      );
      this.logger.debug(
        `Bancos de sistema filtrados: ${systemDatabases.join(', ')}`
      );

      return filteredDatabases;
    } finally {
      client.release();
    }
  }

  /**
   * Test connection to verify credentials and access
   */
  async testConnection(project, instance, database = 'postgres', isSource = null, connectionInfo = {}) {
    try {
      const pool = await this.connect(project, instance, database, isSource, connectionInfo);
      const client = await pool.connect();

      // Get comprehensive server version information for CloudSQL
      const versionResult = await client.query(`
        SELECT 
          version() as full_version,
          current_setting('server_version') as server_version,
          current_setting('server_version_num') as server_version_num,
          inet_server_addr() as server_ip,
          current_database(),
          current_user,
          pg_postmaster_start_time() as server_start_time
      `);

      client.release();

      // Log all version information for debugging
      const row = versionResult.rows[0];
      this.logger.debug(`CloudSQL Connection Details for ${instance}:`, {
        instance_name: instance,
        server_ip: row.server_ip,
        full_version: row.full_version,
        server_version: row.server_version,
        server_version_num: row.server_version_num,
        server_start_time: row.server_start_time,
        database: row.current_database,
        user: row.current_user
      });

      // Use server_version setting which is most reliable for CloudSQL
      let serverVersion = row.server_version;

      // If server_version is not available, parse from full version
      if (!serverVersion && row.full_version) {
        serverVersion = this._parsePostgreSQLVersion(row.full_version);
      }

      this.logger.info(`Instance ${instance} version: ${serverVersion}`);

      return {
        success: true,
        version: serverVersion || 'unknown',
        database: row.current_database,
        user: row.current_user,
        serverInfo: {
          ip: row.server_ip,
          startTime: row.server_start_time,
          versionNum: row.server_version_num
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute SQL query
   */
  async query(project, instance, database, sql, params = []) {
    const pool = await this.connect(project, instance, database);
    const client = await pool.connect();

    try {
      const result = await client.query(sql, params);
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Close a specific connection
   */
  async closeConnection(project, instance, database = null) {
    if (database) {
      const connectionKey = `${project}:${instance}:${database}`;
      await this._closeConnection(connectionKey);
    } else {
      // Close all connections for this instance
      const keysToClose = Array.from(this.connections.keys()).filter((key) =>
        key.startsWith(`${project}:${instance}:`)
      );

      for (const key of keysToClose) {
        await this._closeConnection(key);
      }
    }
  }

  /**
   * Close all connections
   */
  async closeAllConnections() {
    const promises = Array.from(this.connections.keys()).map((key) =>
      this._closeConnection(key)
    );
    await Promise.all(promises);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const stats = {};

    for (const [key, pool] of this.connections.entries()) {
      stats[key] = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };
    }

    return stats;
  }

  // Private methods

  async _closeConnection(connectionKey) {
    if (this.connections.has(connectionKey)) {
      const pool = this.connections.get(connectionKey);
      try {
        await pool.end();
        this.logger.debug(`Conexão fechada: ${connectionKey}`);
      } catch (error) {
        this.logger.warn(
          `Erro ao fechar conexão ${connectionKey}:`,
          error.message
        );
      } finally {
        this.connections.delete(connectionKey);
      }
    }
  }

  _parsePostgreSQLVersion(versionString) {
    if (!versionString) return 'unknown';

    // Handle server_version format (like "15.4", "16.1")
    if (/^\d+\.\d+/.test(versionString)) {
      return versionString;
    }

    // Handle full version string format
    const match = versionString.match(/PostgreSQL\s+(\d+(?:\.\d+)*)/);
    return match ? match[1] : 'unknown';
  }

  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _getProxyPort() {
    // Cloud SQL Proxy typically uses port 5432 + hash of instance
    // This is a simplified version - in reality you'd configure this
    return 5432;
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default ConnectionManager;
