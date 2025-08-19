import { google } from 'googleapis';

class CloudSQLManager {
  constructor(logger, project) {
    this.logger = logger;
    this.project = project;
    this.sqladmin = null;
    this.auth = null;
  }

  /**
   * Initialize authentication and SQL Admin API client
   */
  async init() {
    try {
      // Use Application Default Credentials
      this.auth = new google.auth.GoogleAuth({
        scopes: [
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/sqlservice.admin'
        ]
      });

      // Get auth client
      const authClient = await this.auth.getClient();

      // Initialize SQL Admin API
      this.sqladmin = google.sqladmin({ version: 'v1', auth: authClient });

      this.logger.info(
        `🔑 CloudSQL Manager initialized for project: ${this.project}`
      );

      return true;
    } catch (error) {
      this.logger.error(
        'Failed to initialize CloudSQL Manager:',
        error.message
      );
      throw error;
    }
  }

  /**
   * Get detailed information about a CloudSQL instance
   */
  async getInstanceDetails(instanceName) {
    try {
      this.logger.debug(`🔍 Getting details for instance: ${instanceName}`);

      const response = await this.sqladmin.instances.get({
        project: this.project,
        instance: instanceName
      });

      const instanceData = response.data;

      // Extract relevant information
      const details = {
        name: instanceData.name,
        databaseVersion: instanceData.databaseVersion,
        state: instanceData.state,
        settings: {
          tier: instanceData.settings?.tier,
          dataDiskSizeGb: instanceData.settings?.dataDiskSizeGb,
          dataDiskType: instanceData.settings?.dataDiskType
        },
        ipAddresses: instanceData.ipAddresses || [],
        region: instanceData.region,
        backendType: instanceData.backendType,
        createTime: instanceData.createTime,
        connectionName: instanceData.connectionName
      };

      // Get public IP if available
      const publicIp = this.extractPublicIP(details.ipAddresses);
      if (publicIp) {
        details.publicIp = publicIp;
      }

      // Parse PostgreSQL version from databaseVersion (e.g., "POSTGRES_14" -> "14.x")
      details.parsedVersion = this.parseDatabaseVersion(
        details.databaseVersion
      );

      this.logger.debug(`✅ Instance details retrieved for ${instanceName}:`, {
        version: details.parsedVersion,
        state: details.state,
        publicIp: details.publicIp || 'None'
      });

      return details;
    } catch (error) {
      this.logger.warn(
        `⚠️ Failed to get details for instance ${instanceName}:`,
        error.message
      );

      // Return error details for CSV generation
      return {
        name: instanceName,
        error: error.message,
        databaseVersion: 'API_ERROR',
        parsedVersion: 'ERROR',
        state: 'UNKNOWN'
      };
    }
  }

  /**
   * Get databases for a CloudSQL instance via API
   */
  async getInstanceDatabases(instanceName) {
    try {
      this.logger.debug(`📊 Getting databases for instance: ${instanceName}`);

      const response = await this.sqladmin.databases.list({
        project: this.project,
        instance: instanceName
      });

      const databases = response.data.items || [];

      // Filter out system databases
      const systemDatabases = [
        'postgres',
        'template0',
        'template1',
        'cloudsqladmin',
        'information_schema',
        'performance_schema'
      ];

      const userDatabases = databases
        .filter((db) => !systemDatabases.includes(db.name))
        .filter((db) => !db.name.startsWith('pg_'))
        .filter((db) => !db.name.startsWith('template'))
        .filter((db) => !db.name.startsWith('cloudsql'))
        .map((db) => db.name);

      this.logger.debug(
        `📋 Found ${userDatabases.length} user databases for ${instanceName}:`,
        userDatabases
      );

      return userDatabases;
    } catch (error) {
      this.logger.warn(
        `⚠️ Failed to get databases for instance ${instanceName}:`,
        error.message
      );
      return [`API_ERROR: ${error.message}`];
    }
  }

  /**
   * Get comprehensive inventory for multiple instances
   */
  async getInstancesInventory(instanceNames) {
    const inventory = [];

    this.logger.info(`📝 Processing ${instanceNames.length} instances...`);

    for (let i = 0; i < instanceNames.length; i++) {
      const instanceName = instanceNames[i];

      this.logger.info(
        `[${i + 1}/${instanceNames.length}] Processing: ${instanceName}`
      );

      try {
        // Get instance details via API
        const details = await this.getInstanceDetails(instanceName);

        // Get databases via API
        const databases = await this.getInstanceDatabases(instanceName);

        const inventoryItem = {
          instance: instanceName,
          version: details.parsedVersion,
          databaseVersion: details.databaseVersion,
          state: details.state,
          databases: databases.join(';'),
          publicIp: details.publicIp || 'None',
          region: details.region || 'Unknown',
          tier: details.settings?.tier || 'Unknown',
          connectionName: details.connectionName || 'Unknown',
          error: details.error || null
        };

        inventory.push(inventoryItem);

        // Log progress
        if (details.error) {
          this.logger.warn(`❌ ${instanceName}: ${details.error}`);
        } else {
          this.logger.info(
            `✅ ${instanceName}: ${details.parsedVersion} (${databases.length} databases)`
          );
        }
      } catch (error) {
        this.logger.error(
          `💥 Unexpected error processing ${instanceName}:`,
          error.message
        );

        inventory.push({
          instance: instanceName,
          version: 'FATAL_ERROR',
          databaseVersion: 'FATAL_ERROR',
          state: 'UNKNOWN',
          databases: error.message,
          publicIp: 'Unknown',
          region: 'Unknown',
          tier: 'Unknown',
          connectionName: 'Unknown',
          error: error.message
        });
      }
    }

    return inventory;
  }

  /**
   * List all CloudSQL instances in the project (optional utility)
   */
  async listAllInstances() {
    try {
      this.logger.debug('📋 Listing all CloudSQL instances in project...');

      const response = await this.sqladmin.instances.list({
        project: this.project
      });

      const instances = response.data.items || [];

      this.logger.info(
        `Found ${instances.length} CloudSQL instances in project ${this.project}`
      );

      return instances.map((instance) => ({
        name: instance.name,
        databaseVersion: instance.databaseVersion,
        state: instance.state,
        region: instance.region
      }));
    } catch (error) {
      this.logger.error('Failed to list CloudSQL instances:', error.message);
      throw error;
    }
  }

  // Private helper methods

  /**
   * Extract public IP from ipAddresses array
   */
  extractPublicIP(ipAddresses) {
    if (!ipAddresses || !Array.isArray(ipAddresses)) {
      return null;
    }

    const publicIpEntry = ipAddresses.find((ip) => ip.type === 'PRIMARY');
    return publicIpEntry ? publicIpEntry.ipAddress : null;
  }

  /**
   * Parse database version string to a more readable format
   */
  parseDatabaseVersion(databaseVersion) {
    if (!databaseVersion) return 'Unknown';

    // Handle formats like "POSTGRES_14", "POSTGRES_15", etc.
    const match = databaseVersion.match(/POSTGRES[_](\d+)/i);
    if (match) {
      return match[1]; // Return just the major version number
    }

    // Handle other formats
    if (databaseVersion.includes('POSTGRES')) {
      return databaseVersion.replace('POSTGRES_', '').replace('POSTGRES', 'PG');
    }

    return databaseVersion;
  }
}

export default CloudSQLManager;
