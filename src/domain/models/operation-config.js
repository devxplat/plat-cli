/**
 * Operation Configuration Model
 * Standardized configuration for all tool operations
 */
class OperationConfig {
  constructor(data = {}) {
    // Source configuration
    this.source = {
      project: data.source?.project,
      instance: data.source?.instance,
      databases: data.source?.databases || null,
      ...data.source
    };

    // Target configuration
    this.target = {
      project: data.target?.project,
      instance: data.target?.instance,
      ...data.target
    };

    // Operation options
    this.options = {
      includeAll: data.options?.includeAll || false,
      retryAttempts: data.options?.retryAttempts || 3,
      jobs: data.options?.jobs || 1,
      dryRun: data.options?.dryRun || false,
      verbose: data.options?.verbose || false,
      forceCompatibility: data.options?.forceCompatibility || false,
      schemaOnly: data.options?.schemaOnly || false,
      dataOnly: data.options?.dataOnly || false,
      // Users and roles migration options
      includeUsersRoles: data.options?.includeUsersRoles || false,
      passwordStrategy: data.options?.passwordStrategy || null,
      ...data.options
    };

    // Tool-specific metadata
    this.metadata = {
      toolName: data.metadata?.toolName,
      version: data.metadata?.version || '1.0.0',
      executionId: data.metadata?.executionId || this._generateId(),
      timestamp: data.metadata?.timestamp || new Date().toISOString(),
      ...data.metadata
    };
  }

  /**
   * Validate the configuration
   * @returns {Object} Validation result with errors if any
   */
  validate() {
    const errors = [];

    // Validate source
    if (!this.source.project) {
      errors.push('Source project is required');
    }
    if (!this.source.instance) {
      errors.push('Source instance is required');
    }

    // Validate target (if not a read-only operation)
    if (
      this.metadata.toolName &&
      !this.metadata.toolName.includes('list') &&
      !this.metadata.toolName.includes('test')
    ) {
      if (!this.target.project) {
        errors.push('Target project is required');
      }
      if (!this.target.instance) {
        errors.push('Target instance is required');
      }
    }

    // Validate database selection for migration operations
    if (this.metadata.toolName && this.metadata.toolName.includes('migrate')) {
      if (
        !this.options.includeAll &&
        (!this.source.databases || this.source.databases.length === 0)
      ) {
        errors.push('Either specify databases or use includeAll option');
      }
    }

    // Validate conflicting options
    if (this.options.schemaOnly && this.options.dataOnly) {
      errors.push('Cannot specify both schemaOnly and dataOnly options');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert to plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      source: { ...this.source },
      target: { ...this.target },
      options: { ...this.options },
      metadata: { ...this.metadata }
    };
  }

  /**
   * Create from command line arguments (classic CLI)
   * @param {Object} args - Parsed command line arguments
   * @returns {OperationConfig} Configuration instance
   */
  static fromCliArgs(args) {
    return new OperationConfig({
      source: {
        project: args.sourceProject,
        instance: args.sourceInstance,
        ip: args.sourceIp,
        user: args.sourceUser || 'postgres',
        password: args.sourcePassword,
        databases: args.databases
          ? args.databases.split(',').map((s) => s.trim())
          : null
      },
      target: {
        project: args.targetProject,
        instance: args.targetInstance,
        ip: args.targetIp,
        user: args.targetUser || 'postgres',
        password: args.targetPassword
      },
      options: {
        includeAll: args.includeAll,
        retryAttempts: parseInt(args.retryAttempts, 10),
        jobs: parseInt(args.jobs, 10),
        dryRun: args.dryRun,
        verbose: args.verbose,
        forceCompatibility: args.forceCompatibility,
        schemaOnly: args.schemaOnly,
        dataOnly: args.dataOnly,
        sslMode: args.sslMode || 'simple',
        useProxy: args.useProxy || false,
        bypassConfirmation: args.bypassConfirmation || false,
        // Users and roles migration options
        includeUsersRoles: args.includeUsersRoles || false,
        userSelectionMode: args.usersToMigrate ? 'specific' : (args.migrateAllUsers ? 'all' : 'all'),
        selectedUsers: args.usersToMigrate ? {
          all: args.usersToMigrate.split(',').map(u => u.trim())
        } : null,
        passwordStrategy: args.passwordStrategy ? {
          type: args.passwordStrategy,
          defaultPassword: args.defaultPassword,
          password: args.sourcePassword // For 'same' strategy
        } : null
      },
      metadata: {
        toolName: args.toolName || 'gcp.cloudsql.migrate',
        source: 'classic-cli'
      }
    });
  }

  /**
   * Create from interactive session data
   * @param {Object} answers - Interactive CLI answers
   * @returns {OperationConfig} Configuration instance
   */
  static fromInteractiveAnswers(answers) {
    return new OperationConfig({
      source: answers.source,
      target: answers.target,
      options: answers.options,
      metadata: {
        toolName: answers.toolName,
        source: 'interactive-cli'
      }
    });
  }

  /**
   * Generate a unique execution ID
   * @private
   */
  _generateId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default OperationConfig;
