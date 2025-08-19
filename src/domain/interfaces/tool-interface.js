/**
 * Abstract Tool Interface - Domain Contract
 * All tools must implement this interface to ensure consistency
 */
class ITool {
  /**
   * Get metadata about this tool
   * @returns {Object} Tool metadata
   */
  static get metadata() {
    throw new Error('Tool must implement static metadata getter');
  }

  /**
   * Validate configuration before execution
   * @param {Object} config - Tool configuration
   * @throws {Error} If configuration is invalid
   * @returns {Promise<void>}
   */
  async validate() {
    throw new Error('Tool must implement validate method');
  }

  /**
   * Execute the tool with given configuration
   * @param {Object} config - Tool configuration
   * @param {Function} progressCallback - Progress reporting callback
   * @returns {Promise<Object>} Execution result
   */
  async execute() {
    throw new Error('Tool must implement execute method');
  }

  /**
   * Get time and resource estimates for the operation
   * @param {Object} config - Tool configuration
   * @returns {Promise<Object>} Estimation details
   */
  async getEstimate() {
    throw new Error('Tool must implement getEstimate method');
  }

  /**
   * Check if tool can handle the given configuration
   * @param {Object} config - Tool configuration
   * @returns {Boolean} True if tool can handle the config
   */
  canHandle() {
    return true; // Default implementation
  }

  /**
   * Get help information for this tool
   * @returns {Object} Help documentation
   */
  getHelp() {
    return {
      description: 'No description available',
      usage: 'Usage information not provided',
      examples: []
    };
  }
}

export default ITool;
