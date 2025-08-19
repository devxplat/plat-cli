/**
 * Execution State Model
 * Tracks the state and progress of tool executions
 */
class ExecutionState {
  constructor(config = {}) {
    this.id = config.metadata?.executionId || this._generateId();
    this.toolName = config.metadata?.toolName;
    this.status = 'pending'; // pending, running, completed, failed, cancelled
    this.startTime = null;
    this.endTime = null;
    this.currentPhase = null;
    this.completedPhases = [];
    this.totalPhases = [];
    this.errors = [];
    this.warnings = [];
    this.metrics = {
      totalSize: 0,
      processedSize: 0,
      estimatedDuration: 0,
      actualDuration: 0,
      throughput: 0
    };
    this.result = null;
    this.config = config;
  }

  /**
   * Start execution
   * @param {Array} phases - List of execution phases
   */
  start(phases = []) {
    this.status = 'running';
    this.startTime = new Date();
    this.totalPhases = [...phases];
    this.completedPhases = [];
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Move to next phase
   * @param {String} phaseName - Name of the current phase
   */
  setCurrentPhase(phaseName) {
    if (
      this.currentPhase &&
      !this.completedPhases.includes(this.currentPhase)
    ) {
      this.completedPhases.push(this.currentPhase);
    }
    this.currentPhase = phaseName;
  }

  /**
   * Update metrics
   * @param {Object} metrics - Metrics to update
   */
  updateMetrics(metrics) {
    this.metrics = { ...this.metrics, ...metrics };
  }

  /**
   * Add error
   * @param {Error|String} error - Error to add
   */
  addError(error) {
    const errorData = {
      timestamp: new Date().toISOString(),
      message: error.message || error,
      stack: error.stack,
      phase: this.currentPhase
    };
    this.errors.push(errorData);
  }

  /**
   * Add warning
   * @param {String} message - Warning message
   */
  addWarning(message) {
    const warningData = {
      timestamp: new Date().toISOString(),
      message,
      phase: this.currentPhase
    };
    this.warnings.push(warningData);
  }

  /**
   * Complete execution successfully
   * @param {Object} result - Execution result
   */
  complete(result) {
    this.status = 'completed';
    this.endTime = new Date();
    this.result = result;

    if (
      this.currentPhase &&
      !this.completedPhases.includes(this.currentPhase)
    ) {
      this.completedPhases.push(this.currentPhase);
    }

    this.metrics.actualDuration = this.endTime - this.startTime;
  }

  /**
   * Fail execution
   * @param {Error} error - Failure error
   */
  fail(error) {
    this.status = 'failed';
    this.endTime = new Date();
    this.addError(error);
    this.metrics.actualDuration = this.endTime - this.startTime;
  }

  /**
   * Cancel execution
   */
  cancel() {
    this.status = 'cancelled';
    this.endTime = new Date();
    this.metrics.actualDuration = this.endTime - this.startTime;
  }

  /**
   * Get current progress percentage
   * @returns {Number} Progress percentage (0-100)
   */
  getProgress() {
    if (this.totalPhases.length === 0) return 0;
    return Math.round(
      (this.completedPhases.length / this.totalPhases.length) * 100
    );
  }

  /**
   * Get execution duration in milliseconds
   * @returns {Number} Duration in milliseconds
   */
  getDuration() {
    if (!this.startTime) return 0;
    const endTime = this.endTime || new Date();
    return endTime - this.startTime;
  }

  /**
   * Get human-readable status summary
   * @returns {Object} Status summary
   */
  getStatusSummary() {
    return {
      id: this.id,
      toolName: this.toolName,
      status: this.status,
      progress: this.getProgress(),
      currentPhase: this.currentPhase,
      duration: this.getDuration(),
      errors: this.errors.length,
      warnings: this.warnings.length,
      hasResult: !!this.result
    };
  }

  /**
   * Check if execution can be resumed
   * @returns {Boolean} True if can be resumed
   */
  canResume() {
    return this.status === 'failed' && this.errors.length > 0;
  }

  /**
   * Convert to plain object
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      toolName: this.toolName,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      currentPhase: this.currentPhase,
      completedPhases: [...this.completedPhases],
      totalPhases: [...this.totalPhases],
      errors: [...this.errors],
      warnings: [...this.warnings],
      metrics: { ...this.metrics },
      result: this.result,
      config: this.config.toJSON()
    };
  }

  /**
   * Create from saved state
   * @param {Object} data - Saved state data
   * @returns {ExecutionState} State instance
   */
  static async fromJSON(data) {
    const { default: OperationConfig } = await import('./operation-config.js');
    const config = new OperationConfig(data.config);
    const state = new ExecutionState(config);

    Object.assign(state, {
      id: data.id,
      toolName: data.toolName,
      status: data.status,
      startTime: data.startTime ? new Date(data.startTime) : null,
      endTime: data.endTime ? new Date(data.endTime) : null,
      currentPhase: data.currentPhase,
      completedPhases: data.completedPhases || [],
      totalPhases: data.totalPhases || [],
      errors: data.errors || [],
      warnings: data.warnings || [],
      metrics: data.metrics || {},
      result: data.result
    });

    return state;
  }

  /**
   * Generate a unique execution ID
   * @private
   */
  _generateId() {
    return `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ExecutionState;
