// Configuration managed by ConfigManager

import { Command } from 'commander';
import chalk from 'chalk';
import { colors } from './colors.js';
import renderMigrationSummary from '../common/utils/render-migration-summary.js';

// Import application services - using dynamic imports to avoid circular dependencies
// Services are imported dynamically in init() method to avoid circular dependencies

// Import domain models
import OperationConfig from '../../domain/models/operation-config.js';
import { 
  detectMigrationPattern, 
  getRecommendedStrategy, 
  validateStrategyCompatibility,
  getAllStrategyValues,
  getAllConflictResolutionValues,
  getStrategyDescription,
  getConflictResolutionDescription
} from '../../domain/strategies/migration-strategies.js';

/**
 * Classic CLI Interface
 * Traditional command-line interface using commander.js
 */
class ClassicCLI {
  constructor() {
    this.program = new Command();

    // Prevent process.exit() during tests
    if (process.env.NODE_ENV === 'test') {
      this.program.exitOverride();
    }

    this.logger = null;
    this.coordinator = null;
    this.initialized = false;
  }

  /**
   * Initialize CLI components
   */
  async init() {
    if (this.initialized) return;

    // Dynamically import services
    const { default: Logger } = await import(
      '../../infrastructure/logging/winston-logger.js'
    );
    const { default: ProgressTracker } = await import(
      '../../application/progress-tracker.js'
    );
    const { default: ValidationEngine } = await import(
      '../../application/validation-engine.js'
    );
    const { default: CommandCoordinator } = await import(
      '../../application/command-coordinator.js'
    );

    // Initialize logger
    this.logger = new Logger({
      level: 'info',
      enableFile: true,
      cliMode: true,
      quiet: false
    });

    // Initialize application services
    const progressTracker = new ProgressTracker(this.logger);
    const validator = new ValidationEngine({ logger: this.logger });

    this.coordinator = new CommandCoordinator({
      validator,
      progressTracker,
      logger: this.logger
    });

    // Initialize the coordinator to setup tools
    await this.coordinator.initialize();

    // Setup CLI commands
    this.setupCommands();
    this.initialized = true;
  }

  /**
   * Validate connection parameters for a single instance
   */
  validateConnectionParams(prefix, options, errors = []) {
    const project = options[`${prefix}Project`];
    const instance = options[`${prefix}Instance`];
    const ip = options[`${prefix}Ip`];
    const password = options[`${prefix}Password`];
    const user = options[`${prefix}User`] || 'postgres';
    const useProxy = options.useProxy;

    // Check if basic parameters are provided
    if (!project) {
      errors.push(`❌ ${prefix.charAt(0).toUpperCase() + prefix.slice(1)} project is missing. Use --${prefix}-project`);
    }
    if (!instance) {
      errors.push(`❌ ${prefix.charAt(0).toUpperCase() + prefix.slice(1)} instance is missing. Use --${prefix}-instance`);
    }

    // If not using proxy, need IP
    if (!useProxy) {
      // Check for IP - either from CLI or environment
      if (!ip) {
        const envIpKey = `CLOUDSQL_${prefix.toUpperCase()}_IP`;
        const instanceIpKey = `CLOUDSQL_IP_${instance?.replace(/-/g, '_').toUpperCase()}`;
        
        if (!process.env[envIpKey] && !process.env[instanceIpKey] && !process.env.USE_CLOUD_SQL_PROXY) {
          errors.push(`❌ ${prefix.charAt(0).toUpperCase() + prefix.slice(1)} IP is missing. Use --${prefix}-ip or set ${envIpKey} environment variable`);
        }
      }
    }

    // Password is always required (even with proxy)
    const envPasswordKey = `PGPASSWORD_${prefix.toUpperCase()}`;
    const altPasswordKey = `CLOUDSQL_${prefix.toUpperCase()}_PASSWORD`;
    if (!password && !process.env[envPasswordKey] && !process.env[altPasswordKey] && !process.env.PGPASSWORD) {
      errors.push(`❌ ${prefix.charAt(0).toUpperCase() + prefix.slice(1)} password is missing. Use --${prefix}-password or set ${envPasswordKey} environment variable`);
    }

    return errors;
  }

  /**
   * Validate migration parameters
   */
  validateMigrationParams(options) {
    const errors = [];

    // Validate source connection
    this.validateConnectionParams('source', options, errors);

    // Validate target connection
    this.validateConnectionParams('target', options, errors);

    // Validate database selection
    if (!options.includeAll && !options.databases) {
      errors.push('❌ No databases specified. Use --databases or --include-all');
    }

    return errors;
  }

  /**
   * Setup commander.js commands
   */
  setupCommands() {
    this.program
      .name('plat-cli')
      .description(
        'Platform Engineering DevEx CLI - Simplify complex cloud operations'
      )
      .version('2.0.0');

    // GCP CloudSQL commands
    this.setupCloudSQLCommands();

    // Global help
    this.program.on('--help', () => {
      this.showGlobalHelp();
    });
  }

  /**
   * Setup CloudSQL specific commands
   */
  setupCloudSQLCommands() {
    const gcp = this.program
      .command('gcp')
      .description('Google Cloud Platform operations');

    const cloudsql = gcp
      .command('cloudsql')
      .description('CloudSQL database operations');

    // Migration command
    cloudsql
      .command('migrate')
      .description('Migrate PostgreSQL databases between CloudSQL instances')
      .option('--source-project <project>', 'Source GCP project')
      .option(
        '--source-instance <instance>',
        'Source CloudSQL instance'
      )
      .option('--source-ip <ip>', 'Source instance public IP address')
      .option('--source-user <user>', 'Source database user', 'postgres')
      .option('--source-password <password>', 'Source database password')
      .option('--target-project <project>', 'Target GCP project')
      .option(
        '--target-instance <instance>',
        'Target CloudSQL instance'
      )
      .option('--target-ip <ip>', 'Target instance public IP address')
      .option('--target-user <user>', 'Target database user', 'postgres')
      .option('--target-password <password>', 'Target database password')
      .option('--databases <databases>', 'Comma-separated list of databases')
      .option('--include-all', 'Migrate all databases', false)
      .option('--schema-only', 'Migrate schema only', false)
      .option('--data-only', 'Migrate data only', false)
      .option('--dry-run', 'Simulate migration', false)
      .option('--retry-attempts <number>', 'Retry attempts', '3')
      .option('--jobs <number>', 'Parallel jobs', '1')
      .option('--ssl-mode <mode>', 'SSL mode (disable/simple/strict)', 'simple')
      .option('--use-proxy', 'Use Cloud SQL Auth Proxy', false)
      .option('--force-compatibility', 'Skip compatibility checks', false)
      .option('--verbose', 'Detailed logging', false)
      .option('--bypass-confirmation', 'Skip confirmation prompts for automation', false)
      .option('--config <file>', 'Configuration file')
      .option('--sources-file <file>', 'File with source instances (txt/json/csv)')
      .option('--mapping-file <file>', 'Migration mapping file (json)')
      .option('--strategy <strategy>', 'Migration strategy (auto-detected if not specified: simple, consolidate, distribute, replicate, version-based, round-robin, split-by-database, manual-mapping, custom)')
      .option('--conflict-resolution <resolution>', 'Conflict resolution (fail, prefix, suffix, merge, rename-schema)')
      .option('--max-parallel <number>', 'Max parallel migrations', '3')
      .option('--stop-on-error', 'Stop batch on first error', false)
      .option('--default-project <project>', 'Default GCP project for instances')
      .action(this.handleMigrate.bind(this));

    // Test connection command
    cloudsql
      .command('test-connection')
      .description('Test connectivity to CloudSQL instance')
      .requiredOption('--project <project>', 'GCP project')
      .requiredOption('--instance <instance>', 'CloudSQL instance')
      .option('--ip <ip>', 'Instance public IP address')
      .option('--user <user>', 'Database user', 'postgres')
      .option('--password <password>', 'Database password')
      .option('--source-user <user>', 'Source database user')
      .option('--source-password <password>', 'Source database password')
      .option('--target-user <user>', 'Target database user')
      .option('--target-password <password>', 'Target database password')
      .option('--database <database>', 'Specific database', 'postgres')
      .option('--ssl-mode <mode>', 'SSL mode (disable/simple/strict)', 'simple')
      .option('--use-proxy', 'Use Cloud SQL Auth Proxy', false)
      .option('--verbose', 'Detailed logging', false)
      .action(this.handleTestConnection.bind(this));

    // List databases command
    cloudsql
      .command('list-databases')
      .description('List databases in CloudSQL instance')
      .requiredOption('--project <project>', 'GCP project')
      .requiredOption('--instance <instance>', 'CloudSQL instance')
      .option('--ip <ip>', 'Instance public IP address')
      .option('--user <user>', 'Database user', 'postgres')
      .option('--password <password>', 'Database password')
      .option('--ssl-mode <mode>', 'SSL mode (disable/simple/strict)', 'simple')
      .option('--use-proxy', 'Use Cloud SQL Auth Proxy', false)
      .option('--verbose', 'Detailed logging', false)
      .action(this.handleListDatabases.bind(this));

    // Interactive mode command
    this.program
      .command('interactive')
      .alias('ui')
      .description('Launch interactive CLI interface')
      .option('--tool <tool>', 'Pre-select tool')
      .action(this.handleInteractive.bind(this));

    // Tools command
    this.program
      .command('tools')
      .description('List available tools and get help')
      .option('--tool <tool>', 'Get help for specific tool')
      .action(this.handleTools.bind(this));
  }

  /**
   * Validate and enhance strategy options with intelligent defaults
   */
  async validateAndEnhanceStrategy(options) {
    // Validate strategy parameter if provided
    if (options.strategy) {
      const validStrategies = getAllStrategyValues();
      if (!validStrategies.includes(options.strategy)) {
        console.log(colors.error(`❌ Invalid strategy: ${options.strategy}`));
        console.log(colors.warning('Available strategies:'));
        validStrategies.forEach(strategy => {
          console.log(colors.tertiary(`  • ${strategy}: ${getStrategyDescription(strategy)}`));
        });
        process.exit(1);
      }
    }

    // Validate conflict resolution parameter if provided
    if (options.conflictResolution) {
      const validResolutions = getAllConflictResolutionValues();
      if (!validResolutions.includes(options.conflictResolution)) {
        console.log(colors.error(`❌ Invalid conflict resolution: ${options.conflictResolution}`));
        console.log(colors.warning('Available conflict resolutions:'));
        validResolutions.forEach(resolution => {
          console.log(colors.tertiary(`  • ${resolution}: ${getConflictResolutionDescription(resolution)}`));
        });
        process.exit(1);
      }
    }

    // For single migrations, detect pattern and suggest strategy
    if (!options.sourcesFile && !options.mappingFile) {
      // Single migration: always 1:1 pattern
      const pattern = '1:1';
      const recommendedStrategy = getRecommendedStrategy(pattern);
      
      // Set default strategy if not provided
      if (!options.strategy) {
        options.strategy = recommendedStrategy;
        console.log(colors.tertiary(`💡 Auto-detected migration pattern: ${pattern}`));
        console.log(colors.tertiary(`💡 Using recommended strategy: ${options.strategy} (${getStrategyDescription(options.strategy)})`));
      } else {
        // Validate provided strategy against pattern
        const validation = validateStrategyCompatibility(options.strategy, pattern);
        if (validation.warnings.length > 0) {
          console.log(colors.warning('⚠️ Strategy warnings:'));
          validation.warnings.forEach(warning => {
            console.log(colors.warning(`  • ${warning}`));
          });
        }
      }

      // Set default conflict resolution if not provided
      if (!options.conflictResolution) {
        options.conflictResolution = 'fail'; // Safe default for single migrations
      }
    }
  }

  /**
   * Handle migrate command
   */
  async handleMigrate(options) {
    try {
      // Update logger level if verbose
      if (options.verbose) {
        this.logger.level = 'debug';
      }

      // Check if batch migration (sources-file or mapping-file provided)
      if (options.sourcesFile || options.mappingFile) {
        await this.handleBatchMigration(options);
        return;
      }

      // Validate required parameters for single migration
      const validationErrors = this.validateMigrationParams(options);
      
      if (validationErrors.length > 0) {
        console.log(colors.error('\n⚠️  Missing required parameters:\n'));
        validationErrors.forEach(error => console.log('  ' + error));
        console.log(colors.warning('\n💡 Tips:'));
        console.log(colors.tertiary('  • You can use environment variables for sensitive data'));
        console.log(colors.tertiary('  • Set PGPASSWORD_SOURCE for source database password'));
        console.log(colors.tertiary('  • Set PGPASSWORD_TARGET for target database password'));
        console.log(colors.tertiary('  • Set CLOUDSQL_SOURCE_IP and CLOUDSQL_TARGET_IP for IPs'));
        console.log(colors.tertiary('  • Use --use-proxy if using Cloud SQL Auth Proxy'));
        console.log(colors.tertiary('  • Use --sources-file or --mapping-file for batch migrations'));
        console.log('');
        process.exit(1);
      }

      // Validate and enhance strategy options
      await this.validateAndEnhanceStrategy(options);

      console.log(colors.primary('🚀 Starting CloudSQL Migration'));

      // Create configuration from CLI arguments
      const config = OperationConfig.fromCliArgs({
        ...options,
        toolName: 'gcp.cloudsql.migrate'
      });

      // Load config file if specified
      if (options.config) {
        await this.mergeConfigFile(config, options.config);
      }

      // Display configuration summary
      await this.displayConfigSummary(config);

      // Confirm if not dry run
      if (!options.dryRun) {
        const confirmed = await this.confirmOperation(config);
        if (!confirmed) {
          console.log(colors.warning('Operation cancelled by user'));
          return;
        }
      }

      // Execute migration
      const result = await this.coordinator.execute(
        'gcp.cloudsql.migrate',
        config
      );

      // Wait for progress tracker to complete before showing summary
      await this.waitForProgressTrackerCompletion();

      // Display results
      this.displayResults(result, config);
    } catch (error) {
      console.log(colors.error('❌ Migration failed:'), error.message);
      if (options.verbose) {
        console.log(colors.tertiary(error.stack));
      }
      process.exit(1);
    }
  }

  /**
   * Handle batch migration
   */
  async handleBatchMigration(options) {
    try {
      console.log(colors.primary('🚀 Starting Batch CloudSQL Migration'));

      // Import required modules
      const { default: InstanceParser } = await import(
        '../../infrastructure/utils/instance-parser.js'
      );
      const { default: MigrationMapping } = await import(
        '../../domain/models/migration-mapping.js'
      );
      const { default: BatchMigrationCoordinator } = await import(
        '../../application/batch-migration-coordinator.js'
      );

      const parser = new InstanceParser();
      let mapping;

      // Parse input file
      if (options.mappingFile) {
        // Full mapping file provided
        const parsedData = await parser.parseFile(options.mappingFile);
        mapping = MigrationMapping.fromParserOutput(parsedData, {
          options: {
            dryRun: options.dryRun,
            verbose: options.verbose,
            retryAttempts: parseInt(options.retryAttempts) || 3
          }
        });
      } else if (options.sourcesFile) {
        // Sources file provided, need target from CLI
        if (!options.targetProject || !options.targetInstance) {
          console.log(colors.error('❌ Target project and instance required with --sources-file'));
          process.exit(1);
        }

        const parsedData = await parser.parseFile(options.sourcesFile);
        
        // Apply default project if provided
        if (options.defaultProject) {
          parsedData.sources = parsedData.sources.map(s => ({
            project: s.project || options.defaultProject,
            ...s
          }));
        }

        // Detect pattern and determine strategy for batch migration
        const sourceCount = parsedData.sources.length;
        const targetCount = 1; // Single target for sources-file mode
        const detectedPattern = detectMigrationPattern(sourceCount, targetCount);
        
        // Use provided strategy or recommend based on pattern
        let finalStrategy = options.strategy;
        if (!finalStrategy) {
          finalStrategy = getRecommendedStrategy(detectedPattern);
          console.log(colors.tertiary(`💡 Auto-detected migration pattern: ${detectedPattern} (${sourceCount} sources → ${targetCount} target)`));
          console.log(colors.tertiary(`💡 Using recommended strategy: ${finalStrategy} (${getStrategyDescription(finalStrategy)})`));
        } else {
          // Validate provided strategy
          const validation = validateStrategyCompatibility(finalStrategy, detectedPattern);
          if (validation.warnings.length > 0) {
            console.log(colors.warning('⚠️ Strategy warnings:'));
            validation.warnings.forEach(warning => {
              console.log(colors.warning(`  • ${warning}`));
            });
          }
        }

        // Create mapping based on strategy
        mapping = new MigrationMapping({
          strategy: finalStrategy,
          sources: parsedData.sources,
          targets: [{
            project: options.targetProject,
            instance: options.targetInstance
          }],
          conflictResolution: options.conflictResolution || 'fail',
          options: {
            dryRun: options.dryRun,
            verbose: options.verbose,
            retryAttempts: parseInt(options.retryAttempts) || 3
          }
        });
      }

      // Validate mapping
      const validation = mapping.validate();
      if (!validation.valid) {
        console.log(colors.error('❌ Invalid mapping configuration:'));
        validation.errors.forEach(e => console.log(colors.error(`  - ${e}`)));
        process.exit(1);
      }

      // Display warnings
      if (validation.warnings.length > 0) {
        console.log(colors.warning('⚠️ Warnings:'));
        validation.warnings.forEach(w => console.log(colors.warning(`  - ${w}`)));
      }

      // Display mapping summary
      await this.displayBatchSummary(mapping);

      // Confirm if not dry run
      if (!options.dryRun) {
        const confirmed = await this.confirmBatchOperation(mapping, options);
        if (!confirmed) {
          console.log(colors.warning('Operation cancelled by user'));
          return;
        }
      }

      // Create batch coordinator
      const batchCoordinator = new BatchMigrationCoordinator({
        coordinator: this.coordinator,
        logger: this.logger,
        progressTracker: this.coordinator.progressTracker,
        validator: this.coordinator.validator,
        maxParallel: parseInt(options.maxParallel) || 3,
        stopOnError: options.stopOnError,
        retryFailed: true
      });

      // Execute batch migration with progress
      const progressBar = await this.createProgressBar(mapping);
      
      const result = await batchCoordinator.executeBatch(mapping, (progress) => {
        if (progressBar) {
          progressBar.update(progress.current, {
            phase: progress.phase,
            status: progress.status
          });
        } else {
          console.log(colors.primary(`[${progress.phase}] ${progress.status}`));
        }
      });

      if (progressBar) {
        progressBar.stop();
      }

      // Stop progress tracker immediately before showing batch results
      await this.waitForProgressTrackerCompletion();

      // Display batch results
      this.displayBatchResults(result);
      
    } catch (error) {
      console.log(colors.error('❌ Batch migration failed:'), error.message);
      if (options.verbose) {
        console.log(colors.tertiary(error.stack));
      }
      process.exit(1);
    }
  }

  /**
   * Handle test connection command
   */
  async handleTestConnection(options) {
    try {
      if (options.verbose) {
        this.logger.level = 'debug';
      }

      // Validate required parameters
      const errors = [];
      
      if (!options.project) {
        errors.push('❌ Project is missing. Use --project');
      }
      if (!options.instance) {
        errors.push('❌ Instance is missing. Use --instance');
      }

      // Determine if using source/target specific parameters or legacy single parameters
      const hasSourceParams = options.sourceUser || options.sourcePassword;
      const hasTargetParams = options.targetUser || options.targetPassword;
      const hasLegacyParams = options.user || options.password;
      const hasAnySourceTargetFlags = hasSourceParams || hasTargetParams;

      // If not using proxy, need IP
      if (!options.useProxy && !process.env.USE_CLOUD_SQL_PROXY) {
        if (!options.ip && !process.env.CLOUDSQL_SOURCE_IP && !process.env.CLOUDSQL_TARGET_IP) {
          const instanceIpKey = `CLOUDSQL_IP_${options.instance?.replace(/-/g, '_').toUpperCase()}`;
          if (!process.env[instanceIpKey]) {
            errors.push('❌ IP is missing. Use --ip or set CLOUDSQL_SOURCE_IP/CLOUDSQL_TARGET_IP environment variable');
          }
        }
      }
      
      // Validate credentials based on usage pattern
      if (hasAnySourceTargetFlags) {
        // New source/target pattern - validate only specified credentials
        if (hasSourceParams) {
          if (!options.sourcePassword && !process.env.PGPASSWORD_SOURCE && !process.env.PGPASSWORD) {
            errors.push('❌ Source password is missing. Use --source-password or set PGPASSWORD_SOURCE environment variable');
          }
        }
        if (hasTargetParams) {
          if (!options.targetPassword && !process.env.PGPASSWORD_TARGET && !process.env.PGPASSWORD) {
            errors.push('❌ Target password is missing. Use --target-password or set PGPASSWORD_TARGET environment variable');
          }
        }
      } else if (hasLegacyParams) {
        // Legacy pattern with explicit --user or --password provided
        if (!options.password && !process.env.PGPASSWORD_SOURCE && !process.env.PGPASSWORD_TARGET && !process.env.PGPASSWORD) {
          errors.push('❌ Password is missing. Use --password or set PGPASSWORD_SOURCE/PGPASSWORD_TARGET/PGPASSWORD environment variable');
        }
      } else {
        // No credentials provided at all
        errors.push('❌ No credentials provided. Use --user/--password for single test or --source-user/--source-password and/or --target-user/--target-password for source/target tests');
      }
      
      if (errors.length > 0) {
        console.log(colors.error('\n⚠️  Missing required parameters:\n'));
        errors.forEach(error => console.log('  ' + error));
        console.log(colors.warning('\n💡 Tips:'));
        console.log(colors.tertiary('  • Legacy mode: Use --user and --password for single connection test'));
        console.log(colors.tertiary('  • Source/Target mode: Use --source-user/--source-password and/or --target-user/--target-password'));
        console.log(colors.tertiary('  • You can use PGPASSWORD_SOURCE/PGPASSWORD_TARGET environment variables'));
        console.log(colors.tertiary('  • Use --use-proxy if using Cloud SQL Auth Proxy'));
        console.log(colors.tertiary('  • Get the public IP from GCP Console → SQL → Instance → Connectivity'));
        console.log('');
        process.exit(1);
      }

      const { default: ConnectionManager } = await import(
        '../../infrastructure/cloud/gcp-connection-manager.js'
      );
      const connectionManager = new ConnectionManager(this.logger);

      const tests = [];
      
      if (hasAnySourceTargetFlags) {
        // Source/Target mode
        console.log(colors.primary('🔌 Testing CloudSQL connection(s)...'));
        
        if (hasSourceParams) {
          tests.push({
            type: 'Source',
            isSource: true,
            connectionInfo: {
              ip: options.ip,
              user: options.sourceUser || 'postgres',
              password: options.sourcePassword,
              sslMode: options.sslMode || 'simple',
              useProxy: options.useProxy || false
            }
          });
        }
        
        if (hasTargetParams) {
          tests.push({
            type: 'Target',
            isSource: false,
            connectionInfo: {
              ip: options.ip,
              user: options.targetUser || 'postgres',
              password: options.targetPassword,
              sslMode: options.sslMode || 'simple',
              useProxy: options.useProxy || false
            }
          });
        }
      } else {
        // Legacy mode
        console.log(colors.primary('🔌 Testing CloudSQL connection...'));
        tests.push({
          type: 'Legacy',
          isSource: null,
          connectionInfo: {
            ip: options.ip,
            user: options.user || 'postgres',
            password: options.password,
            sslMode: options.sslMode || 'simple',
            useProxy: options.useProxy || false
          }
        });
      }

      let allSuccessful = true;
      const results = [];

      for (const test of tests) {
        try {
          console.log(colors.tertiary(`\n🧪 Testing ${test.type} connection...`));
          
          const result = await connectionManager.testConnection(
            options.project,
            options.instance,
            options.database,
            test.isSource,
            test.connectionInfo
          );

          if (result.success) {
            console.log(colors.success(`✅ ${test.type} connection successful!`));
            console.log(colors.tertiary(`   Version: ${result.version}`));
            console.log(colors.tertiary(`   Database: ${result.database}`));
            console.log(colors.tertiary(`   User: ${result.user}`));
            results.push({ type: test.type, success: true, result });
          } else {
            console.log(colors.error(`❌ ${test.type} connection failed:`), result.error);
            results.push({ type: test.type, success: false, error: result.error });
            allSuccessful = false;
          }
        } catch (error) {
          console.log(colors.error(`❌ ${test.type} connection error:`), error.message);
          results.push({ type: test.type, success: false, error: error.message });
          allSuccessful = false;
        }
      }

      // Summary
      console.log('\n' + colors.primary('📊 Connection Test Summary:'));
      results.forEach(result => {
        if (result.success) {
          console.log(colors.success(`   ✅ ${result.type}: Connected successfully`));
        } else {
          console.log(colors.error(`   ❌ ${result.type}: Failed - ${result.error}`));
        }
      });

      if (!allSuccessful) {
        process.exit(1);
      }

    } catch (error) {
      console.log(colors.error('❌ Error:'), error.message);
      if (options.verbose) {
        console.log(colors.tertiary(error.stack));
      }
      process.exit(1);
    }
  }

  /**
   * Handle list databases command
   */
  async handleListDatabases(options) {
    try {
      if (options.verbose) {
        this.logger.level = 'debug';
      }

      // Validate required parameters (same as test-connection)
      const errors = [];
      
      if (!options.project) {
        errors.push('❌ Project is missing. Use --project');
      }
      if (!options.instance) {
        errors.push('❌ Instance is missing. Use --instance');
      }
      
      // If not using proxy, need IP
      if (!options.useProxy && !process.env.USE_CLOUD_SQL_PROXY) {
        if (!options.ip && !process.env.CLOUDSQL_SOURCE_IP && !process.env.CLOUDSQL_TARGET_IP) {
          const instanceIpKey = `CLOUDSQL_IP_${options.instance?.replace(/-/g, '_').toUpperCase()}`;
          if (!process.env[instanceIpKey]) {
            errors.push('❌ IP is missing. Use --ip or set CLOUDSQL_SOURCE_IP/CLOUDSQL_TARGET_IP environment variable');
          }
        }
      }
      
      // Password is always required
      // For test-connection/list-databases, check both source and target passwords
      if (!options.password && !process.env.PGPASSWORD_SOURCE && !process.env.PGPASSWORD_TARGET && !process.env.PGPASSWORD) {
        errors.push('❌ Password is missing. Use --password or set PGPASSWORD_SOURCE/PGPASSWORD_TARGET/PGPASSWORD environment variable');
      }
      
      if (errors.length > 0) {
        console.log(colors.error('\n⚠️  Missing required parameters:\n'));
        errors.forEach(error => console.log('  ' + error));
        console.log(colors.warning('\n💡 Tips:'));
        console.log(colors.tertiary('  • You can use PGPASSWORD_SOURCE/PGPASSWORD_TARGET environment variables for passwords'));
        console.log(colors.tertiary('  • Use --use-proxy if using Cloud SQL Auth Proxy'));
        console.log(colors.tertiary('  • Get the public IP from GCP Console → SQL → Instance → Connectivity'));
        console.log('');
        process.exit(1);
      }

      console.log(colors.primary('📊 Listing databases...'));

      const { default: ConnectionManager } = await import(
        '../../infrastructure/cloud/gcp-connection-manager.js'
      );
      const connectionManager = new ConnectionManager(this.logger);

      const connectionInfo = {
        ip: options.ip,
        user: options.user || 'postgres',
        password: options.password,
        sslMode: options.sslMode || 'simple',
        useProxy: options.useProxy || false
      };

      const databases = await connectionManager.listDatabases(
        options.project,
        options.instance,
        null, // isSource not relevant
        connectionInfo
      );

      if (databases.length === 0) {
        console.log(colors.warning('ℹ️ No databases found'));
        return;
      }

      console.log(colors.success(`📊 Found ${databases.length} databases:`));
      console.log('');

      databases.forEach((db, index) => {
        console.log(
          chalk.cyan(`${index + 1}.`),
          chalk.white(db.name),
          chalk.gray(`(${db.sizeFormatted})`)
        );
      });

      const totalSize = databases.reduce((sum, db) => sum + db.sizeBytes, 0);
      console.log('');
      console.log(colors.warning('Total:'), this.formatBytes(totalSize));
    } catch (error) {
      console.log(colors.error('❌ Error:'), error.message);
      if (options.verbose) {
        console.log(colors.tertiary(error.stack));
      }
      process.exit(1);
    }
  }

  /**
   * Handle interactive mode
   */
  async handleInteractive(options) {
    console.log(colors.primary('🎨 Launching interactive CLI...'));

    try {
      const { default: InteractiveCLI } = await import('../tui/index.js');
      const interactiveCLI = new InteractiveCLI({
        coordinator: this.coordinator,
        logger: this.logger,
        preselectedTool: options.tool
      });

      await interactiveCLI.start();
    } catch (error) {
      console.log(
        chalk.red('❌ Failed to launch interactive mode:'),
        error.message
      );
      console.log(colors.tertiary('Falling back to classic CLI mode'));
    }
  }

  /**
   * Handle tools command
   */
  async handleTools(options) {
    if (options.tool) {
      // Show help for specific tool
      try {
        const help = this.coordinator.getToolHelp(options.tool);
        this.displayToolHelp(help, options.tool);
      } catch (error) {
        console.log(colors.error('❌ Error:'), error.message);
        process.exit(1);
      }
    } else {
      // List all available tools
      const tools = this.coordinator.getAvailableTools();
      this.displayAvailableTools(tools);
    }
  }

  /**
   * Display configuration summary
   */
  async displayConfigSummary(config) {
    console.log(colors.collectiveSecondary('📋 Configuration Summary:'));
    console.log('');
    
    // Source information
    console.log(colors.primary('   Source:'));
    console.log(chalk.white(`      Project:  ${config.source.project}`));
    console.log(chalk.white(`      Instance: ${config.source.instance}`));
    if (config.source.ip) {
      console.log(chalk.white(`      IP:       ${config.source.ip}`));
    }
    console.log(chalk.white(`      User:     ${config.source.user || 'postgres'}`));
    console.log(chalk.white(`      Password: ${config.source.password ? '********' : 'Not provided'}`));
    
    console.log('');
    
    // Target information
    console.log(colors.primary('   Target:'));
    console.log(chalk.white(`      Project:  ${config.target.project}`));
    console.log(chalk.white(`      Instance: ${config.target.instance}`));
    if (config.target.ip) {
      console.log(chalk.white(`      IP:       ${config.target.ip}`));
    }
    console.log(chalk.white(`      User:     ${config.target.user || 'postgres'}`));
    console.log(chalk.white(`      Password: ${config.target.password ? '********' : 'Not provided'}`));
    
    console.log('');
    
    // Migration details
    console.log(colors.primary('   Migration Details:'));
    console.log(
      chalk.white(
        `      Databases: ${config.options.includeAll ? 'ALL' : config.source.databases?.join(', ') || 'None specified'}`
      )
    );
    
    // Connection method
    if (config.options.useProxy) {
      console.log(chalk.white(`      Connection: Cloud SQL Auth Proxy`));
    } else {
      console.log(chalk.white(`      Connection: Direct IP (SSL: ${config.options.sslMode || 'simple'})`));
    }
    
    // Migration options
    if (config.options.schemaOnly) {
      console.log(chalk.white(`      Mode: Schema only (no data)`));
    } else if (config.options.dataOnly) {
      console.log(chalk.white(`      Mode: Data only (no schema)`));
    } else {
      console.log(chalk.white(`      Mode: Full migration (schema + data)`));
    }
    
    if (config.options.jobs && config.options.jobs > 1) {
      console.log(chalk.white(`      Parallel jobs: ${config.options.jobs}`));
    }
    
    if (config.options.retryAttempts) {
      console.log(chalk.white(`      Retry attempts: ${config.options.retryAttempts}`));
    }
    
    if (config.options.forceCompatibility) {
      console.log(colors.warning(`      ⚠️  Force compatibility: Enabled`));
    }
    
    if (config.options.dryRun) {
      console.log(colors.collectiveSecondary(`      🔍 DRY RUN: Simulation mode (no changes will be made)`));
    }

    console.log('');
  }

  /**
   * Confirm operation with user
   */
  async confirmOperation(config) {
    // Check for bypass confirmation flag
    if (config?.options?.bypassConfirmation) {
      console.log(colors.warning('⚡ Bypassing confirmation (--bypass-confirmation flag)'));
      return true;
    }

    // Use new Ink-based SelectPrompt
    const { default: SelectPrompt } = await import('../common/prompts/SelectPrompt.js');
    return await SelectPrompt.prompt({
      message: '⚠️ This will migrate data between CloudSQL instances. Continue?',
      choices: [
        { label: '❌ No, cancel operation', value: false },
        { label: '✅ Yes, proceed with migration', value: true }
      ],
      defaultValue: false
    });
  }

  /**
   * Display execution results
   */
  displayResults(result, config) {
    if (config.options.dryRun) {
      console.log(colors.success('✅ Dry run completed successfully'));
      if (result.databasesToMigrate) {
        console.log(
          colors.primary(
            `   Would migrate ${result.databasesToMigrate.length} databases`
          )
        );
      }
    } else {
      // Display migration summary for successful migrations
      this.displayMigrationSummary(result, config);
    }
  }

  /**
   * Stop progress tracker immediately to show migration summary
   */
  async waitForProgressTrackerCompletion() {
    // Immediately stop the progress tracker Ink display for classic CLI
    if (this.coordinator.progressTracker && this.coordinator.progressTracker.inkInstance) {
      this.coordinator.progressTracker.inkInstance.unmount();
      this.coordinator.progressTracker.inkInstance = null;
      this.coordinator.progressTracker.isActive = false;
      // Clear any pending timers
      if (this.coordinator.progressTracker.timerInterval) {
        clearInterval(this.coordinator.progressTracker.timerInterval);
        this.coordinator.progressTracker.timerInterval = null;
      }
    }
  }

  /**
   * Display migration summary using shared MigrationSummary component
   */
  displayMigrationSummary(result, config) {
    // Use the shared MigrationSummary component
    renderMigrationSummary(result, config, false);
    console.log(''); // Add spacing after the summary
  }

  /**
   * Display available tools
   */
  displayAvailableTools(tools) {
    console.log(colors.primary('🔧 Available Tools:'));
    console.log('');

    tools.forEach((tool) => {
      console.log(chalk.white(`  ${tool.name}`));
      console.log(colors.tertiary(`    ${tool.metadata.description}`));
      console.log(
        chalk.gray(
          `    Category: ${tool.metadata.category} | Provider: ${tool.metadata.provider}`
        )
      );
      console.log('');
    });

    console.log(
      chalk.yellow('Use --tool <name> to get detailed help for a specific tool')
    );
  }

  /**
   * Display tool help
   */
  displayToolHelp(help, toolName) {
    console.log(colors.primary(`🔧 Help for ${toolName}:`));
    console.log('');
    console.log(chalk.white(help.description));
    console.log('');

    if (help.usage) {
      console.log(colors.warning('Usage:'));
      console.log(`  ${help.usage}`);
      console.log('');
    }

    if (help.options && help.options.length > 0) {
      console.log(colors.warning('Options:'));
      help.options.forEach((option) => {
        console.log(`  ${option}`);
      });
      console.log('');
    }

    if (help.examples && help.examples.length > 0) {
      console.log(colors.warning('Examples:'));
      help.examples.forEach((example) => {
        console.log(`  ${chalk.gray(example.description)}`);
        console.log(`  ${example.command}`);
        console.log('');
      });
    }
  }

  /**
   * Show global help
   */
  showGlobalHelp() {
    console.log('');
    console.log(colors.primary('Platform Engineering DevEx CLI'));
    console.log(
      chalk.gray(
        'Simplify complex cloud operations with developer experience in mind'
      )
    );
    console.log('');
    console.log('Examples:');
    console.log('  # Migrate CloudSQL databases');
    console.log(
      '  $ plat-cli gcp cloudsql migrate --source-project my-source --source-instance source-db \\'
    );
    console.log(
      '    --target-project my-target --target-instance target-db --include-all'
    );
    console.log('');
    console.log('  # Launch interactive mode');
    console.log('  $ plat-cli interactive');
    console.log('');
    console.log('  # List available tools');
    console.log('  $ plat-cli tools');
    console.log('');
  }

  /**
   * Merge configuration file
   */
  async mergeConfigFile(config, configFile) {
    const { promises: fs } = await import('fs');
    try {
      const fileContent = await fs.readFile(configFile, 'utf8');
      const fileConfig = JSON.parse(fileContent);

      // Merge file config into existing config
      Object.assign(config.source, fileConfig.source || {});
      Object.assign(config.target, fileConfig.target || {});
      Object.assign(config.options, fileConfig.options || {});

      this.logger.info(`Configuration loaded from: ${configFile}`);
    } catch (error) {
      throw new Error(`Failed to load config file: ${error.message}`);
    }
  }

  /**
   * Display batch migration summary
   */
  async displayBatchSummary(mapping) {
    const summary = mapping.getSummary();
    
    console.log(colors.warning('📋 Batch Migration Summary:'));
    console.log('');
    console.log(chalk.white(`   Strategy: ${summary.strategy}`));
    console.log(chalk.white(`   Mapping Type: ${summary.mappingType}`));
    console.log(chalk.white(`   Total Sources: ${summary.totalSources}`));
    console.log(chalk.white(`   Total Targets: ${summary.totalTargets}`));
    console.log(chalk.white(`   Total Migrations: ${summary.totalMigrations}`));
    console.log(chalk.white(`   Conflict Resolution: ${summary.conflictResolution}`));
    console.log('');
    
    if (summary.tasks.length <= 10) {
      console.log(colors.primary('Migration Tasks:'));
      summary.tasks.forEach((task, index) => {
        console.log(colors.tertiary(`  ${index + 1}. ${task.from} → ${task.to}`));
      });
    } else {
      console.log(colors.primary(`Showing first 5 of ${summary.tasks.length} migration tasks:`));
      summary.tasks.slice(0, 5).forEach((task, index) => {
        console.log(colors.tertiary(`  ${index + 1}. ${task.from} → ${task.to}`));
      });
      console.log(colors.tertiary(`  ... and ${summary.tasks.length - 5} more`));
    }
    console.log('');
  }

  /**
   * Confirm batch operation with user
   */
  async confirmBatchOperation(mapping, options) {
    const summary = mapping.getSummary();
    
    // Check for bypass confirmation flag
    if (options?.bypassConfirmation) {
      console.log(colors.warning('⚡ Bypassing confirmation (--bypass-confirmation flag)'));
      return true;
    }

    // Use new Ink-based SelectPrompt
    const { default: SelectPrompt } = await import('../common/prompts/SelectPrompt.js');
    return await SelectPrompt.prompt({
      message: `⚠️ This will execute ${summary.totalMigrations} migrations. Continue?`,
      choices: [
        { label: '❌ No, cancel operation', value: false },
        { label: '✅ Yes, proceed with batch migration', value: true }
      ],
      defaultValue: false
    });
  }

  /**
   * Create progress bar for batch operations
   */
  async createProgressBar(mapping) {
    // Progress is now handled by progress-tracker with its own visual
    // No need for cli-progress library anymore
    return null;
  }

  /**
   * Display batch migration results using shared MigrationSummary component
   */
  displayBatchResults(result) {
    // Format result for MigrationSummary component
    const formattedResult = {
      operations: [],
      totalDuration: result.summary.duration
    };

    // Add successful operations
    if (result.successful) {
      result.successful.forEach(migration => {
        formattedResult.operations.push({
          status: 'success',
          config: {
            source: {
              project: migration.source.split(':')[0],
              instance: migration.source.split(':')[1],
              databases: migration.databases
            },
            target: {
              project: migration.target.split(':')[0],
              instance: migration.target.split(':')[1]
            }
          },
          duration: migration.duration
        });
      });
    }

    // Add failed operations
    if (result.failed) {
      result.failed.forEach(migration => {
        formattedResult.operations.push({
          status: 'error',
          config: {
            source: {
              project: migration.source.split(':')[0],
              instance: migration.source.split(':')[1],
              databases: migration.databases
            },
            target: {
              project: migration.target.split(':')[0],
              instance: migration.target.split(':')[1]
            }
          },
          error: migration.error
        });
      });
    }

    // Use the shared MigrationSummary component
    renderMigrationSummary(formattedResult, null, true);
    
    // Keep detailed failure information if needed
    if (result.failed.length > 0) {
      console.log('');
      console.log(colors.error('❌ Failed Migrations:'));
      result.failed.forEach((migration, index) => {
        console.log(colors.error(`   ${index + 1}. ${migration.source} → ${migration.target}`));
        console.log(colors.error(`      Error: ${migration.error}`));
      });
      console.log('');
    }

    // Skipped migrations
    if (result.skipped.length > 0) {
      console.log(colors.warning('⏭️ Skipped Migrations:'));
      result.skipped.forEach((migration, index) => {
        console.log(colors.warning(`   ${index + 1}. ${migration.source} → ${migration.target}`));
        console.log(colors.tertiary(`      Reason: ${migration.reason}`));
      });
      console.log('');
    }

    console.log(colors.success('═══════════════════════════════════════════════════'));
  }

  /**
   * Format duration helper
   * @private
   */
  _formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Run the CLI
   */
  async run(argv) {
    try {
      await this.init();
      await this.program.parseAsync(argv);
    } catch (error) {
      console.error(chalk.red('CLI Error:'), error.message);

      // Don't exit in test environment, let the error bubble up
      if (process.env.NODE_ENV === 'test') {
        throw error;
      }

      process.exit(1);
    }
  }
}

export default ClassicCLI;
