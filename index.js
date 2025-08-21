// Import interfaces
import ClassicCLI from './src/interfaces/classicCLI/index.js';
import InteractiveCLI from './src/interfaces/interactiveCLI/index.js';

// Import application services
import CommandCoordinator from './src/application/command-coordinator.js';
import ValidationEngine from './src/application/validation-engine.js';
import ProgressTracker from './src/application/progress-tracker.js';

// Import infrastructure
import Logger from './src/infrastructure/logging/winston-logger.js';

// Import domain models
import OperationConfig from './src/domain/models/operation-config.js';

/**
 * Platform Engineering CLI - Main API
 * Supports both programmatic usage and CLI interfaces
 */
class PlatCli {
  constructor(config = {}) {
    this.config = config;
    this.logger = null;
    this.coordinator = null;
    this._initialized = false;
    // Note: Services will be initialized on first use
  }

  /**
   * Initialize core services
   * @private
   */
  async _initializeServices() {
    if (this._initialized) return;
    
    // Initialize logger
    this.logger = new Logger({
      level: this.config.logLevel || 'info',
      enableFile: this.config.enableFileLogging !== false,
      cliMode: this.config.cliMode !== false,
      quiet: this.config.quiet || false,
      ...this.config.logger
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
    this._initialized = true;
  }

  /**
   * Execute a tool programmatically
   * @param {String} toolName - Name of the tool to execute
   * @param {Object|OperationConfig} config - Tool configuration
   * @returns {Promise<Object>} Execution result
   */
  async execute(toolName, config) {
    // Ensure services are initialized
    await this._initializeServices();
    
    // Convert plain object to OperationConfig if needed
    const operationConfig =
      config instanceof OperationConfig
        ? config
        : new OperationConfig({
            ...config,
            metadata: {
              toolName,
              source: 'programmatic',
              ...config.metadata
            }
          });

    return await this.coordinator.execute(toolName, operationConfig);
  }

  /**
   * Migrate databases (legacy compatibility method)
   * @param {Object} migrationConfig - Migration configuration
   * @returns {Promise<Object>} Migration result
   */
  async migrate(migrationConfig) {
    return await this.execute('gcp.cloudsql.migrate', migrationConfig);
  }

  /**
   * Get available tools
   * @returns {Array} Available tools
   */
  async getAvailableTools() {
    // Ensure services are initialized
    await this._initializeServices();
    return this.coordinator.getAvailableTools();
  }

  /**
   * Get execution estimate for a tool
   * @param {String} toolName - Tool name
   * @param {Object|OperationConfig} config - Configuration
   * @returns {Promise<Object>} Estimation
   */
  async getEstimate(toolName, config) {
    // Ensure services are initialized
    await this._initializeServices();
    
    const operationConfig =
      config instanceof OperationConfig
        ? config
        : new OperationConfig({ ...config, metadata: { toolName } });

    return await this.coordinator.getExecutionEstimate(
      toolName,
      operationConfig
    );
  }

  /**
   * Launch classic CLI
   * @param {Array} argv - Command line arguments
   */
  async runClassicCLI(argv) {
    const cli = new ClassicCLI();
    return await cli.run(argv);
  }

  /**
   * Launch interactive CLI
   * @param {Object} options - Interactive CLI options
   */
  async runInteractiveCLI(options = {}) {
    // Ensure services are initialized
    await this._initializeServices();
    
    const interactiveCLI = new InteractiveCLI({
      coordinator: this.coordinator,
      logger: this.logger,
      ...options
    });

    return await interactiveCLI.start();
  }
}

// Export main class and interfaces
export default PlatCli;
export { ClassicCLI, InteractiveCLI, OperationConfig };
