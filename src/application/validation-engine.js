/**
 * Validation Engine - Application Service
 * Centralized validation logic for configurations and operations
 */
class ValidationEngine {
  constructor(dependencies = {}) {
    this.logger = dependencies.logger;
  }

  /**
   * Validate operation configuration
   * @param {OperationConfig} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validateConfiguration(config) {
    const errors = [];
    const warnings = [];

    try {
      // Basic configuration validation
      const basicValidation = config.validate();
      if (!basicValidation.valid) {
        errors.push(...basicValidation.errors);
      }

      // Tool-specific validation
      const toolValidation = this._validateByTool(config);
      errors.push(...toolValidation.errors);
      warnings.push(...toolValidation.warnings);

      // Environment validation
      const envValidation = this._validateEnvironment(config);
      errors.push(...envValidation.errors);
      warnings.push(...envValidation.warnings);

      // Security validation
      const securityValidation = this._validateSecurity(config);
      errors.push(...securityValidation.errors);
      warnings.push(...securityValidation.warnings);
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    const result = {
      valid: errors.length === 0,
      errors: errors.filter((e) => e), // Remove empty errors
      warnings: warnings.filter((w) => w) // Remove empty warnings
    };

    if (this.logger) {
      if (!result.valid) {
        this.logger.warn('Configuration validation failed', {
          errors: result.errors,
          warnings: result.warnings,
          config: config.metadata
        });
      } else if (result.warnings.length > 0) {
        this.logger.warn('Configuration validation passed with warnings', {
          warnings: result.warnings,
          config: config.metadata
        });
      }
    }

    return result;
  }

  /**
   * Validate network connectivity requirements
   * @param {OperationConfig} config - Configuration to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateConnectivity(config) {
    const errors = [];
    const warnings = [];

    try {
      // Check if we're in a network-restricted environment
      const networkCheck = await this._checkNetworkAccess();
      if (!networkCheck.hasInternet) {
        errors.push('No internet connectivity detected');
      }

      // For GCP tools, check GCP connectivity
      if (config.metadata?.toolName?.startsWith('gcp.')) {
        const gcpConnectivity = await this._checkGCPConnectivity();
        if (!gcpConnectivity.canReachGCP) {
          errors.push('Cannot reach GCP endpoints');
        }
        if (gcpConnectivity.hasAuthIssues) {
          warnings.push('GCP authentication may have issues');
        }
      }
    } catch (error) {
      warnings.push(`Connectivity validation error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate required permissions
   * @param {OperationConfig} config - Configuration to validate
   * @returns {Promise<Object>} Validation result
   */
  async validatePermissions(config) {
    const errors = [];
    const warnings = [];

    try {
      // For GCP CloudSQL operations
      if (config.metadata?.toolName?.includes('cloudsql')) {
        const requiredRoles = [
          'roles/cloudsql.client',
          'roles/cloudsql.instanceUser'
        ];

        // This is a placeholder - in a real implementation, you'd check actual IAM permissions
        warnings.push(
          `Ensure service account has required roles: ${requiredRoles.join(', ')}`
        );
      }
    } catch (error) {
      warnings.push(`Permission validation error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate by tool type
   * @private
   */
  _validateByTool(config) {
    const errors = [];
    const warnings = [];

    const toolName = config.metadata?.toolName;

    if (toolName?.includes('migrate')) {
      // Migration-specific validation
      if (
        config.source?.project === config.target?.project &&
        config.source?.instance === config.target?.instance
      ) {
        errors.push('Source and target cannot be the same instance');
      }

      if (config.options?.schemaOnly && config.options?.dataOnly) {
        errors.push('Cannot specify both schema-only and data-only options');
      }

      if (
        !config.options?.includeAll &&
        (!config.source?.databases || config.source.databases.length === 0)
      ) {
        errors.push('Must specify databases or use includeAll option');
      }
    }

    if (toolName?.includes('cloudsql')) {
      // CloudSQL-specific validation
      if (!process.env.PGUSER && !config.source?.user) {
        warnings.push('PostgreSQL user not specified (will use default)');
      }

      if (!process.env.PGPASSWORD && !config.source?.password) {
        warnings.push('PostgreSQL password not specified in environment');
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate environment setup
   * @private
   */
  _validateEnvironment(config) {
    const errors = [];
    const warnings = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (major < 14) {
      warnings.push(
        `Node.js version ${nodeVersion} is below recommended (>=14)`
      );
    }

    // Check required environment variables
    const requiredEnvVars = [];
    const recommendedEnvVars = ['PGUSER', 'PGPASSWORD'];

    if (config.metadata?.toolName?.startsWith('gcp.')) {
      recommendedEnvVars.push('GOOGLE_APPLICATION_CREDENTIALS');
    }

    requiredEnvVars.forEach((envVar) => {
      if (!process.env[envVar]) {
        errors.push(`Required environment variable ${envVar} is not set`);
      }
    });

    recommendedEnvVars.forEach((envVar) => {
      if (!process.env[envVar]) {
        warnings.push(`Recommended environment variable ${envVar} is not set`);
      }
    });

    return { errors, warnings };
  }

  /**
   * Validate security requirements
   * @private
   */
  _validateSecurity(config) {
    const errors = [];
    const warnings = [];

    // Check for potential security issues
    if (config.options?.verbose) {
      warnings.push('Verbose mode may log sensitive information');
    }

    // Validate SSL usage for database connections
    if (config.source?.ssl === false || config.target?.ssl === false) {
      warnings.push('SSL is disabled for database connections');
    }

    // Check for production environment indicators
    const isProd =
      process.env.NODE_ENV === 'production' ||
      config.source?.project?.includes('prod') ||
      config.target?.project?.includes('prod');

    if (isProd && config.options?.dryRun === false) {
      warnings.push(
        'Running in production environment - ensure proper backups'
      );
    }

    return { errors, warnings };
  }

  /**
   * Check network access
   * @private
   */
  async _checkNetworkAccess() {
    try {
      // Simple DNS lookup test
      const dns = await import('dns').then((m) => m.promises);
      await dns.lookup('google.com');
      return { hasInternet: true };
    } catch (error) {
      return { hasInternet: false, error: error.message };
    }
  }

  /**
   * Check GCP connectivity
   * @private
   */
  async _checkGCPConnectivity() {
    try {
      // This would typically involve checking GCP endpoints
      // For now, just check if GOOGLE_APPLICATION_CREDENTIALS is set
      const hasCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

      return {
        canReachGCP: true,
        hasAuthIssues: !hasCredentials
      };
    } catch (error) {
      return {
        canReachGCP: false,
        hasAuthIssues: true,
        error: error.message
      };
    }
  }
}

export default ValidationEngine;
