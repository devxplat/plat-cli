/**
 * Command Coordinator - Application Service
 * Orchestrates tool execution with consistent validation, progress tracking, and error handling
 */
class CommandCoordinator {
  constructor(dependencies = {}) {
    this.validator = dependencies.validator;
    this.progressTracker = dependencies.progressTracker;
    this.logger = dependencies.logger;
    this.toolRegistry = new Map();
    this._initialized = false;
  }

  /**
   * Initialize the coordinator (must be called after construction)
   */
  async initialize() {
    if (!this._initialized) {
      await this._setupToolRegistry();
      this._initialized = true;
    }
  }

  /**
   * Execute a tool with the given configuration
   * @param {String} toolName - Name of the tool to execute (e.g., 'gcp.cloudsql.migrate')
   * @param {OperationConfig} config - Tool configuration
   * @returns {Promise<Object>} Execution result
   */
  async execute(toolName, config, progressCallback = null) {
    // Validate configuration first
    const validation = config.validate();
    if (!validation.valid) {
      throw new Error(
        `Configuration validation failed: ${validation.errors.join(', ')}`
      );
    }

    // Get the appropriate tool
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      throw new Error(
        `Tool '${toolName}' not found. Available tools: ${Array.from(this.toolRegistry.keys()).join(', ')}`
      );
    }

    // Check if tool can handle this configuration
    if (!tool.canHandle(config)) {
      throw new Error(
        `Tool '${toolName}' cannot handle the provided configuration`
      );
    }

    this.logger.info(`Starting execution of tool: ${toolName}`, {
      executionId: config.metadata.executionId,
      toolName,
      source: config.metadata.source
    });

    const steps = [
      'Validation',
      'Discovery',
      'Pre-flight Checks',
      'Export',
      'Import',
      'Post-migration Validation',
      'Cleanup'
    ];
    let currentStepIndex = 0;

    try {
      // Validate tool-specific requirements
      await tool.validate(config);

      // Initialize progress tracker (legacy)
      if (
        this.progressTracker &&
        typeof this.progressTracker.init === 'function'
      ) {
        this.progressTracker.init(steps);
      }

      // Initialize ink progress tracking
      if (progressCallback) {
        progressCallback(currentStepIndex, 0);
      }

      // Execute the tool with progress tracking
      const result = await tool.execute(config, (progress) => {
        // Legacy progress tracker
        if (
          this.progressTracker &&
          typeof this.progressTracker.updateProgress === 'function'
        ) {
          this.progressTracker.updateProgress(progress);
        }

        // Ink-compatible progress callback
        if (progressCallback && progress) {
          // Map progress info to ink format
          if (progress.phase) {
            const stepIndex = steps.indexOf(progress.phase);
            if (stepIndex !== -1) {
              currentStepIndex = stepIndex;
            }
          }

          const stepProgress =
            progress.current && progress.total
              ? Math.round((progress.current / progress.total) * 100)
              : 0;

          progressCallback(currentStepIndex, stepProgress);
        }

        this.logger.debug('Progress update', { progress });
      });

      // Complete progress tracking on success
      if (
        this.progressTracker &&
        typeof this.progressTracker.complete === 'function'
      ) {
        this.progressTracker.complete(result);
      }

      // Complete ink progress tracking
      if (progressCallback) {
        progressCallback(steps.length - 1, 100);
      }

      this.logger.info('Tool execution completed successfully', {
        executionId: config.metadata.executionId,
        toolName,
        result: result ? 'Success' : 'No result'
      });

      return result;
    } catch (error) {
      // Stop progress tracking on error
      if (
        this.progressTracker &&
        typeof this.progressTracker.stop === 'function'
      ) {
        this.progressTracker.stop(error);
      }

      // Notify ink progress of error
      if (progressCallback) {
        progressCallback(currentStepIndex, 0, 'error');
      }

      this.logger.error('Tool execution failed', {
        executionId: config.metadata.executionId,
        toolName,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get information about available tools
   * @returns {Array} List of available tools with metadata
   */
  getAvailableTools() {
    const tools = [];
    for (const [name, tool] of this.toolRegistry) {
      tools.push({
        name,
        metadata: tool.constructor.metadata,
        help: tool.getHelp()
      });
    }
    return tools;
  }

  /**
   * Get a specific tool instance
   * @param {String} toolName - Name of the tool
   * @returns {ITool} Tool instance
   */
  getTool(toolName) {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }
    return tool;
  }

  /**
   * Get help information for a specific tool
   * @param {String} toolName - Name of the tool
   * @returns {Object} Help information
   */
  getToolHelp(toolName) {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }
    return tool.getHelp();
  }

  /**
   * Get time and resource estimate for a tool execution
   * @param {String} toolName - Name of the tool
   * @param {OperationConfig} config - Tool configuration
   * @returns {Promise<Object>} Estimation details
   */
  async getExecutionEstimate(toolName, config) {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    // Validate configuration first
    const validation = config.validate();
    if (!validation.valid) {
      throw new Error(
        `Configuration validation failed: ${validation.errors.join(', ')}`
      );
    }

    try {
      return await tool.getEstimate(config);
    } catch (error) {
      this.logger.warn('Failed to get execution estimate', {
        toolName,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Register a tool in the registry
   * @param {String} name - Tool name
   * @param {ITool} tool - Tool instance
   */
  registerTool(name, tool) {
    this.toolRegistry.set(name, tool);
    this.logger.debug('Tool registered', {
      name,
      metadata: tool.constructor.metadata
    });
  }

  /**
   * Setup the tool registry with available tools
   * @private
   */
  async _setupToolRegistry() {
    try {
      // Manually register known tools (ES6 module compatible)
      await this._registerKnownTools();

      if (this.toolRegistry.size === 0) {
        this.logger.warn(
          'No tools found in registry. Manual registration may be required.'
        );
      } else {
        this.logger.info(`Registered ${this.toolRegistry.size} tools`, {
          tools: Array.from(this.toolRegistry.keys())
        });
      }
    } catch (error) {
      this.logger.error('Failed to setup tool registry', {
        error: error.message
      });
      // Fallback: manually register known tools
      await this._registerFallbackTools();
    }
  }

  /**
   * Register known tools manually (ES6 compatible)
   * @private
   */
  async _registerKnownTools() {
    try {
      // Import and register CloudSQL Migration Tool
      const { default: CloudSQLMigrationTool } = await import(
        '../domain/tools/gcp/cloudsql/migration-tool.js'
      );

      if (
        CloudSQLMigrationTool.metadata &&
        CloudSQLMigrationTool.metadata.name
      ) {
        const dependencies = await this._createToolDependencies();
        const toolInstance = new CloudSQLMigrationTool(dependencies);
        this.registerTool(CloudSQLMigrationTool.metadata.name, toolInstance);
      }
    } catch (error) {
      this.logger.warn('Failed to register CloudSQL Migration Tool', {
        error: error.message
      });
    }
  }

  /**
   * Create dependencies for tools
   * @private
   */
  async _createToolDependencies() {
    // Create infrastructure dependencies
    const { default: ConnectionManager } = await import(
      '../infrastructure/cloud/gcp-connection-manager.js'
    );
    const { default: DatabaseOps } = await import(
      '../infrastructure/cloud/gcp-database-ops.js'
    );
    const { default: MigrationEngine } = await import(
      '../domain/tools/gcp/cloudsql/migration-engine.js'
    );

    const connectionManager = new ConnectionManager(this.logger);
    const databaseOps = new DatabaseOps(connectionManager, this.logger);
    const migrationEngine = new MigrationEngine(
      this.logger,
      connectionManager,
      databaseOps,
      this.progressTracker
    );

    return {
      connectionManager,
      databaseOps,
      migrationEngine,
      logger: this.logger
    };
  }

  /**
   * Fallback tool registration when auto-discovery fails
   * @private
   */
  async _registerFallbackTools() {
    try {
      const { default: CloudSQLMigrationTool } = await import(
        '../domain/tools/gcp/cloudsql/migration-tool.js'
      );
      const dependencies = await this._createToolDependencies();
      const migrationTool = new CloudSQLMigrationTool(dependencies);

      this.registerTool(CloudSQLMigrationTool.metadata.name, migrationTool);

      this.logger.info('Registered fallback tools', {
        tools: Array.from(this.toolRegistry.keys())
      });
    } catch (error) {
      this.logger.error('Failed to register fallback tools', {
        error: error.message
      });
    }
  }
}

export default CommandCoordinator;
