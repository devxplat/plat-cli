/**
 * Default Configuration Schema
 * Claude-style hierarchical configuration with sensible defaults
 */

export const defaultConfig = {
  // Google Cloud Platform settings
  gcp: {
    defaultProject: null, // Will use gcloud default if not set
    keyFile: null, // Path to service account JSON
    region: 'us-central1',
    connectionTimeout: 30000, // 30 seconds
    retryAttempts: 3
  },

  // Database connection settings
  database: {
    connectionTimeout: 30000, // 30 seconds
    retryAttempts: 3,
    poolSize: 10,
    ssl: true,
    user: 'postgres', // Default PostgreSQL user
    password: null, // Will use environment variable
    host: null, // Will be determined dynamically
    port: 5432, // Default PostgreSQL port
    database: null // Will be specified per operation
  },

  // Logging configuration
  logging: {
    level: 'info', // debug, info, warn, error
    enableFile: true,
    enableConsole: true,
    quiet: false
  },

  // UI/TUI settings
  ui: {
    theme: 'default',
    compact: true,
    animations: true,
    progressStyle: 'claude' // claude, simple, detailed
  },

  // Tool-specific settings
  tools: {
    cloudsql: {
      defaultMigrationMode: 'full', // full, schema, data
      dryRunDefault: false,
      parallelConnections: 2
    }
  },

  // CLI behavior
  cli: {
    defaultMode: 'interactive', // interactive, classic
    autoUpdate: false,
    telemetry: false
  }
};

/**
 * Environment variable mappings
 * Maps environment variables to config paths
 */
export const envMappings = {
  PLAT_CLI_GCP_PROJECT: 'gcp.defaultProject',
  PLAT_CLI_GCP_KEY_FILE: 'gcp.keyFile',
  PLAT_CLI_GCP_REGION: 'gcp.region',
  PLAT_CLI_LOG_LEVEL: 'logging.level',
  PLAT_CLI_QUIET: 'logging.quiet',
  PLAT_CLI_DEFAULT_MODE: 'cli.defaultMode',

  // Standard GCP environment variables
  GOOGLE_APPLICATION_CREDENTIALS: 'gcp.keyFile',
  GOOGLE_CLOUD_PROJECT: 'gcp.defaultProject',
  GCLOUD_PROJECT: 'gcp.defaultProject',

  // Database connection environment variables (PostgreSQL standard)
  PGUSER: 'database.user',
  PGPASSWORD: 'database.password',
  PGHOST: 'database.host',
  PGPORT: 'database.port',
  PGDATABASE: 'database.database'
};

/**
 * CLI argument mappings
 * Maps CLI flags to config paths
 */
export const cliMappings = {
  '--project': 'gcp.defaultProject',
  '--gcp-project': 'gcp.defaultProject',
  '--key-file': 'gcp.keyFile',
  '--region': 'gcp.region',
  '--log-level': 'logging.level',
  '--quiet': 'logging.quiet',
  '--verbose': 'logging.level', // Will be mapped to 'debug'
  '--dry-run': 'tools.cloudsql.dryRunDefault'
};

export default defaultConfig;
