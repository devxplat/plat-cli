/**
 * Configuration Manager
 * Claude-style hierarchical configuration loading
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { defaultConfig, envMappings, cliMappings } from './default-config.js';

class ConfigManager {
  constructor() {
    this.config = null;
    this.configPaths = {
      project: './plat-cli.config.json',
      user: path.join(this.getConfigDir(), 'config.json')
    };
  }

  /**
   * Get XDG-compliant config directory
   */
  getConfigDir() {
    const configHome =
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    return path.join(configHome, 'plat-cli');
  }

  /**
   * Get XDG-compliant data directory
   */
  getDataDir() {
    const dataHome =
      process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    return path.join(dataHome, 'plat-cli');
  }

  /**
   * Get XDG-compliant cache directory
   */
  getCacheDir() {
    const cacheHome =
      process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
    return path.join(cacheHome, 'plat-cli');
  }

  /**
   * Load configuration from all sources
   */
  async load(cliArgs = []) {
    if (this.config) return this.config;

    // Start with defaults
    this.config = JSON.parse(JSON.stringify(defaultConfig));

    // 1. Load environment variables
    this.loadFromEnvironment();

    // 2. Load user config
    await this.loadUserConfig();

    // 3. Load project config
    await this.loadProjectConfig();

    // 4. Apply CLI arguments (highest priority)
    this.loadFromCliArgs(cliArgs);

    return this.config;
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnvironment() {
    for (const [envVar, configPath] of Object.entries(envMappings)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        this.setNestedValue(this.config, configPath, this.parseValue(value));
      }
    }
  }

  /**
   * Load user configuration file
   */
  async loadUserConfig() {
    try {
      if (fs.existsSync(this.configPaths.user)) {
        const userConfig = JSON.parse(
          fs.readFileSync(this.configPaths.user, 'utf8')
        );
        this.mergeConfig(this.config, userConfig);
      }
    } catch (error) {
      console.warn(`Warning: Could not load user config: ${error.message}`);
    }
  }

  /**
   * Load project configuration file
   */
  async loadProjectConfig() {
    try {
      if (fs.existsSync(this.configPaths.project)) {
        const projectConfig = JSON.parse(
          fs.readFileSync(this.configPaths.project, 'utf8')
        );
        this.mergeConfig(this.config, projectConfig);
      }
    } catch (error) {
      console.warn(`Warning: Could not load project config: ${error.message}`);
    }
  }

  /**
   * Load configuration from CLI arguments
   */
  loadFromCliArgs(args) {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      for (const [cliFlag, configPath] of Object.entries(cliMappings)) {
        if (arg.startsWith(cliFlag)) {
          let value;

          if (arg.includes('=')) {
            // --flag=value format
            value = arg.split('=')[1];
          } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
            // --flag value format
            value = args[i + 1];
            i++; // Skip next argument
          } else {
            // Boolean flag
            value = true;
          }

          // Special handling for --verbose
          if (cliFlag === '--verbose') {
            value = 'debug';
          }

          this.setNestedValue(this.config, configPath, this.parseValue(value));
        }
      }
    }
  }

  /**
   * Get configuration value by path
   */
  get(path, defaultValue = undefined) {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.getNestedValue(this.config, path) ?? defaultValue;
  }

  /**
   * Set configuration value by path
   */
  async set(path, value, scope = 'user') {
    if (!this.config) await this.load();

    this.setNestedValue(this.config, path, value);

    // Persist to file
    if (scope === 'user') {
      await this.saveUserConfig();
    } else if (scope === 'project') {
      await this.saveProjectConfig();
    }
  }

  /**
   * Save user configuration
   */
  async saveUserConfig() {
    try {
      const configDir = this.getConfigDir();
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Extract only user-configurable values (not defaults)
      const userConfig = this.extractUserConfig();
      fs.writeFileSync(
        this.configPaths.user,
        JSON.stringify(userConfig, null, 2)
      );
    } catch (error) {
      throw new Error(`Could not save user config: ${error.message}`);
    }
  }

  /**
   * Save project configuration
   */
  async saveProjectConfig() {
    try {
      const projectConfig = this.extractUserConfig();
      fs.writeFileSync(
        this.configPaths.project,
        JSON.stringify(projectConfig, null, 2)
      );
    } catch (error) {
      throw new Error(`Could not save project config: ${error.message}`);
    }
  }

  /**
   * Extract user-modified configuration (non-default values)
   */
  extractUserConfig() {
    const userConfig = {};
    this.extractDifferences(defaultConfig, this.config, userConfig);
    return userConfig;
  }

  /**
   * Utility: Set nested object value by dot notation path
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Utility: Get nested object value by dot notation path
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Utility: Deep merge configuration objects
   */
  mergeConfig(target, source) {
    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        if (!target[key]) target[key] = {};
        this.mergeConfig(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Utility: Extract differences between default and current config
   */
  extractDifferences(defaultObj, currentObj, result) {
    for (const key in currentObj) {
      if (currentObj[key] !== defaultObj[key]) {
        if (
          typeof currentObj[key] === 'object' &&
          !Array.isArray(currentObj[key])
        ) {
          result[key] = {};
          this.extractDifferences(
            defaultObj[key] || {},
            currentObj[key],
            result[key]
          );
          if (Object.keys(result[key]).length === 0) {
            delete result[key];
          }
        } else {
          result[key] = currentObj[key];
        }
      }
    }
  }

  /**
   * Utility: Parse string values to appropriate types
   */
  parseValue(value) {
    if (typeof value !== 'string') return value;

    // Boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Numeric values
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

    return value;
  }

  /**
   * Get all configuration as object
   */
  getAll() {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Merge two configuration objects
   * @param {Object} baseConfig - Base configuration
   * @param {Object} overrideConfig - Override configuration
   * @returns {Object} Merged configuration
   */
  mergeConfig(baseConfig, overrideConfig) {
    return this._deepMerge(baseConfig, overrideConfig);
  }

  /**
   * Load configuration from environment variables
   * @returns {Object} Environment-based configuration
   */
  loadFromEnvironment() {
    const envConfig = {};

    // Map environment variables to config
    for (const [envKey, configPath] of Object.entries(envMappings)) {
      if (process.env[envKey]) {
        this._setNestedValue(envConfig, configPath, process.env[envKey]);
      }
    }

    return envConfig;
  }

  /**
   * Reset configuration to defaults
   */
  reset() {
    this.config = null;
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this._deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Set nested value in object using dot notation
   * @param {Object} obj - Target object
   * @param {string} path - Dot notation path
   * @param {*} value - Value to set
   */
  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (
        !(key in current) ||
        typeof current[key] !== 'object' ||
        Array.isArray(current[key])
      ) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }
}

// Singleton instance
const configManager = new ConfigManager();
export default configManager;
