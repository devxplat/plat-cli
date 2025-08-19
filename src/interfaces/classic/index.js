// Configuration managed by ConfigManager

import { Command } from 'commander';
import chalk from 'chalk';

// Import application services - using dynamic imports to avoid circular dependencies
// Services are imported dynamically in init() method to avoid circular dependencies

// Import domain models
import OperationConfig from '../../domain/models/operation-config.js';

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
      .option('--strategy <strategy>', 'Migration strategy (simple/consolidate/version-based/custom)', 'simple')
      .option('--conflict-resolution <resolution>', 'Conflict resolution (fail/prefix/suffix/merge)', 'fail')
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
        console.log(chalk.red('\n⚠️  Missing required parameters:\n'));
        validationErrors.forEach(error => console.log('  ' + error));
        console.log(chalk.yellow('\n💡 Tips:'));
        console.log(chalk.gray('  • You can use environment variables for sensitive data'));
        console.log(chalk.gray('  • Set PGPASSWORD_SOURCE for source database password'));
        console.log(chalk.gray('  • Set PGPASSWORD_TARGET for target database password'));
        console.log(chalk.gray('  • Set CLOUDSQL_SOURCE_IP and CLOUDSQL_TARGET_IP for IPs'));
        console.log(chalk.gray('  • Use --use-proxy if using Cloud SQL Auth Proxy'));
        console.log(chalk.gray('  • Use --sources-file or --mapping-file for batch migrations'));
        console.log('');
        process.exit(1);
      }

      console.log(chalk.cyan('🚀 Starting CloudSQL Migration'));

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
          console.log(chalk.yellow('Operation cancelled by user'));
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
      console.log(chalk.red('❌ Migration failed:'), error.message);
      if (options.verbose) {
        console.log(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  }

  /**
   * Handle batch migration
   */
  async handleBatchMigration(options) {
    try {
      console.log(chalk.cyan('🚀 Starting Batch CloudSQL Migration'));

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
          console.log(chalk.red('❌ Target project and instance required with --sources-file'));
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

        // Create mapping based on strategy
        mapping = new MigrationMapping({
          strategy: options.strategy || 'consolidate',
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
        console.log(chalk.red('❌ Invalid mapping configuration:'));
        validation.errors.forEach(e => console.log(chalk.red(`  - ${e}`)));
        process.exit(1);
      }

      // Display warnings
      if (validation.warnings.length > 0) {
        console.log(chalk.yellow('⚠️ Warnings:'));
        validation.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
      }

      // Display mapping summary
      await this.displayBatchSummary(mapping);

      // Confirm if not dry run
      if (!options.dryRun) {
        const confirmed = await this.confirmBatchOperation(mapping, options);
        if (!confirmed) {
          console.log(chalk.yellow('Operation cancelled by user'));
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
          console.log(chalk.cyan(`[${progress.phase}] ${progress.status}`));
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
      console.log(chalk.red('❌ Batch migration failed:'), error.message);
      if (options.verbose) {
        console.log(chalk.gray(error.stack));
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
        console.log(chalk.red('\n⚠️  Missing required parameters:\n'));
        errors.forEach(error => console.log('  ' + error));
        console.log(chalk.yellow('\n💡 Tips:'));
        console.log(chalk.gray('  • You can use PGPASSWORD_SOURCE/PGPASSWORD_TARGET environment variables for passwords'));
        console.log(chalk.gray('  • Use --use-proxy if using Cloud SQL Auth Proxy'));
        console.log(chalk.gray('  • Get the public IP from GCP Console → SQL → Instance → Connectivity'));
        console.log('');
        process.exit(1);
      }

      console.log(chalk.cyan('🔌 Testing CloudSQL connection...'));

      // For now, use the connection manager directly
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

      const result = await connectionManager.testConnection(
        options.project,
        options.instance,
        options.database,
        null, // isSource not relevant for test
        connectionInfo
      );

      if (result.success) {
        console.log(chalk.green('✅ Connection successful!'));
        console.log(chalk.gray(`   Version: ${result.version}`));
        console.log(chalk.gray(`   Database: ${result.database}`));
        console.log(chalk.gray(`   User: ${result.user}`));
      } else {
        console.log(chalk.red('❌ Connection failed:'), result.error);
        process.exit(1);
      }
    } catch (error) {
      console.log(chalk.red('❌ Error:'), error.message);
      if (options.verbose) {
        console.log(chalk.gray(error.stack));
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
        console.log(chalk.red('\n⚠️  Missing required parameters:\n'));
        errors.forEach(error => console.log('  ' + error));
        console.log(chalk.yellow('\n💡 Tips:'));
        console.log(chalk.gray('  • You can use PGPASSWORD_SOURCE/PGPASSWORD_TARGET environment variables for passwords'));
        console.log(chalk.gray('  • Use --use-proxy if using Cloud SQL Auth Proxy'));
        console.log(chalk.gray('  • Get the public IP from GCP Console → SQL → Instance → Connectivity'));
        console.log('');
        process.exit(1);
      }

      console.log(chalk.cyan('📊 Listing databases...'));

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
        console.log(chalk.yellow('ℹ️ No databases found'));
        return;
      }

      console.log(chalk.green(`📊 Found ${databases.length} databases:`));
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
      console.log(chalk.yellow('Total:'), this.formatBytes(totalSize));
    } catch (error) {
      console.log(chalk.red('❌ Error:'), error.message);
      if (options.verbose) {
        console.log(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  }

  /**
   * Handle interactive mode
   */
  async handleInteractive(options) {
    console.log(chalk.cyan('🎨 Launching interactive CLI...'));

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
      console.log(chalk.gray('Falling back to classic CLI mode'));
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
        console.log(chalk.red('❌ Error:'), error.message);
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
    console.log(chalk.yellow('📋 Configuration Summary:'));
    console.log('');
    
    // Source information
    console.log(chalk.cyan('   Source:'));
    console.log(chalk.white(`      Project:  ${config.source.project}`));
    console.log(chalk.white(`      Instance: ${config.source.instance}`));
    if (config.source.ip) {
      console.log(chalk.white(`      IP:       ${config.source.ip}`));
    }
    console.log(chalk.white(`      User:     ${config.source.user || 'postgres'}`));
    console.log(chalk.white(`      Password: ${config.source.password ? '********' : 'Not provided'}`));
    
    console.log('');
    
    // Target information
    console.log(chalk.cyan('   Target:'));
    console.log(chalk.white(`      Project:  ${config.target.project}`));
    console.log(chalk.white(`      Instance: ${config.target.instance}`));
    if (config.target.ip) {
      console.log(chalk.white(`      IP:       ${config.target.ip}`));
    }
    console.log(chalk.white(`      User:     ${config.target.user || 'postgres'}`));
    console.log(chalk.white(`      Password: ${config.target.password ? '********' : 'Not provided'}`));
    
    console.log('');
    
    // Migration details
    console.log(chalk.cyan('   Migration Details:'));
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
      console.log(chalk.yellow(`      ⚠️  Force compatibility: Enabled`));
    }
    
    if (config.options.dryRun) {
      console.log(chalk.magenta(`      🔍 DRY RUN: Simulation mode (no changes will be made)`));
    }

    console.log('');
  }

  /**
   * Confirm operation with user
   */
  async confirmOperation(config) {
    // Check for bypass confirmation flag
    if (config?.options?.bypassConfirmation) {
      console.log(chalk.yellow('⚡ Bypassing confirmation (--bypass-confirmation flag)'));
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
      console.log(chalk.green('✅ Dry run completed successfully'));
      if (result.databasesToMigrate) {
        console.log(
          chalk.cyan(
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
   * Display migration summary
   */
  displayMigrationSummary(result, config) {
    console.log('');
    console.log(chalk.green('═══════════════════════════════════════════════════'));
    console.log(chalk.green('              MIGRATION COMPLETED                  '));
    console.log(chalk.green('═══════════════════════════════════════════════════'));
    console.log('');

    // Basic migration info
    console.log(chalk.cyan('📊 Migration Summary:'));
    console.log(chalk.white(`   Source: ${config.source.project}/${config.source.instance}`));
    console.log(chalk.white(`   Target: ${config.target.project}/${config.target.instance}`));
    
    // Database information
    if (result.processedDatabases) {
      console.log(chalk.white(`   Databases migrated: ${result.processedDatabases}`));
    } else if (result.databasesToMigrate) {
      console.log(chalk.white(`   Databases migrated: ${result.databasesToMigrate.length}`));
    } else if (config.options.includeAll) {
      console.log(chalk.white(`   Databases migrated: All available databases`));
    } else if (config.source.databases) {
      console.log(chalk.white(`   Databases migrated: ${config.source.databases.join(', ')}`));
    }

    // Size and duration information
    if (result.totalSize) {
      console.log(chalk.white(`   Total size: ${result.totalSize}`));
    }
    if (result.duration) {
      console.log(chalk.white(`   Duration: ${result.duration}`));
    }

    // Migration mode
    if (config.options.schemaOnly) {
      console.log(chalk.white(`   Mode: Schema only`));
    } else if (config.options.dataOnly) {
      console.log(chalk.white(`   Mode: Data only`));
    } else {
      console.log(chalk.white(`   Mode: Full migration (schema + data)`));
    }

    // Additional result information
    if (result.message) {
      console.log(chalk.yellow(`   Status: ${result.message}`));
    }

    console.log('');
    console.log(chalk.green('✅ Migration completed successfully'));
    console.log(chalk.green('═══════════════════════════════════════════════════'));
    console.log('');
  }

  /**
   * Display available tools
   */
  displayAvailableTools(tools) {
    console.log(chalk.cyan('🔧 Available Tools:'));
    console.log('');

    tools.forEach((tool) => {
      console.log(chalk.white(`  ${tool.name}`));
      console.log(chalk.gray(`    ${tool.metadata.description}`));
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
    console.log(chalk.cyan(`🔧 Help for ${toolName}:`));
    console.log('');
    console.log(chalk.white(help.description));
    console.log('');

    if (help.usage) {
      console.log(chalk.yellow('Usage:'));
      console.log(`  ${help.usage}`);
      console.log('');
    }

    if (help.options && help.options.length > 0) {
      console.log(chalk.yellow('Options:'));
      help.options.forEach((option) => {
        console.log(`  ${option}`);
      });
      console.log('');
    }

    if (help.examples && help.examples.length > 0) {
      console.log(chalk.yellow('Examples:'));
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
    console.log(chalk.cyan('Platform Engineering DevEx CLI'));
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
    
    console.log(chalk.yellow('📋 Batch Migration Summary:'));
    console.log('');
    console.log(chalk.white(`   Strategy: ${summary.strategy}`));
    console.log(chalk.white(`   Mapping Type: ${summary.mappingType}`));
    console.log(chalk.white(`   Total Sources: ${summary.totalSources}`));
    console.log(chalk.white(`   Total Targets: ${summary.totalTargets}`));
    console.log(chalk.white(`   Total Migrations: ${summary.totalMigrations}`));
    console.log(chalk.white(`   Conflict Resolution: ${summary.conflictResolution}`));
    console.log('');
    
    if (summary.tasks.length <= 10) {
      console.log(chalk.cyan('Migration Tasks:'));
      summary.tasks.forEach((task, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${task.from} → ${task.to}`));
      });
    } else {
      console.log(chalk.cyan(`Showing first 5 of ${summary.tasks.length} migration tasks:`));
      summary.tasks.slice(0, 5).forEach((task, index) => {
        console.log(chalk.gray(`  ${index + 1}. ${task.from} → ${task.to}`));
      });
      console.log(chalk.gray(`  ... and ${summary.tasks.length - 5} more`));
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
      console.log(chalk.yellow('⚡ Bypassing confirmation (--bypass-confirmation flag)'));
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
   * Display batch migration results
   */
  displayBatchResults(result) {
    console.log('');
    console.log(chalk.green('═══════════════════════════════════════════════════'));
    console.log(chalk.green('                BATCH MIGRATION RESULTS            '));
    console.log(chalk.green('═══════════════════════════════════════════════════'));
    console.log('');

    // Summary
    console.log(chalk.cyan('📊 Summary:'));
    console.log(chalk.white(`   Strategy: ${result.summary.strategy}`));
    console.log(chalk.white(`   Mapping Type: ${result.summary.mappingType}`));
    console.log(chalk.white(`   Total Tasks: ${result.summary.totalTasks}`));
    console.log(chalk.green(`   ✅ Successful: ${result.summary.successful}`));
    
    if (result.summary.failed > 0) {
      console.log(chalk.red(`   ❌ Failed: ${result.summary.failed}`));
    }
    
    if (result.summary.skipped > 0) {
      console.log(chalk.yellow(`   ⏭️ Skipped: ${result.summary.skipped}`));
    }
    
    console.log(chalk.white(`   Success Rate: ${result.summary.successRate}`));
    console.log(chalk.white(`   Duration: ${result.summary.durationFormatted}`));
    console.log('');

    // Performance metrics
    if (result.performance) {
      console.log(chalk.cyan('⚡ Performance:'));
      console.log(chalk.white(`   Average Duration: ${this._formatDuration(result.performance.avgDuration)}`));
      console.log(chalk.white(`   Min Duration: ${this._formatDuration(result.performance.minDuration)}`));
      console.log(chalk.white(`   Max Duration: ${this._formatDuration(result.performance.maxDuration)}`));
      console.log('');
    }

    // Successful migrations
    if (result.successful.length > 0) {
      console.log(chalk.green('✅ Successful Migrations:'));
      result.successful.forEach((migration, index) => {
        console.log(chalk.green(`   ${index + 1}. ${migration.source} → ${migration.target}`));
        console.log(chalk.gray(`      Databases: ${migration.databases.join(', ') || 'all'}`));
        console.log(chalk.gray(`      Duration: ${migration.durationFormatted}`));
      });
      console.log('');
    }

    // Failed migrations
    if (result.failed.length > 0) {
      console.log(chalk.red('❌ Failed Migrations:'));
      result.failed.forEach((migration, index) => {
        console.log(chalk.red(`   ${index + 1}. ${migration.source} → ${migration.target}`));
        console.log(chalk.red(`      Error: ${migration.error}`));
      });
      console.log('');
    }

    // Skipped migrations
    if (result.skipped.length > 0) {
      console.log(chalk.yellow('⏭️ Skipped Migrations:'));
      result.skipped.forEach((migration, index) => {
        console.log(chalk.yellow(`   ${index + 1}. ${migration.source} → ${migration.target}`));
        console.log(chalk.gray(`      Reason: ${migration.reason}`));
      });
      console.log('');
    }

    console.log(chalk.green('═══════════════════════════════════════════════════'));
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
