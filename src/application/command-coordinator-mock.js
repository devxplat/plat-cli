/**
 * Mock Command Coordinator for testing TUI
 */
class CommandCoordinatorMock {
  constructor(options = {}) {
    this.includeTestTools = options.includeTestTools || false;

    this.tools = [
      {
        name: 'gcp.cloudsql.migrate',
        metadata: {
          description: 'CloudSQL Migration Tool',
          category: 'database'
        }
      }
    ];

    // Only include test tools when explicitly requested (for testing)
    if (this.includeTestTools) {
      this.tools.push({
        name: 'test.simple',
        metadata: {
          description: 'Simple Test Tool',
          category: 'testing'
        }
      });
    }
  }

  getAvailableTools() {
    return this.tools;
  }

  async getExecutionEstimate() {
    return {
      totalSizeBytes: 1024 * 1024 * 100, // 100MB mock
      estimatedDurationMinutes: 5
    };
  }

  async execute(_toolName, _config, progressCallback) {
    console.log(`Mock executing tool`);

    // Simulate progress
    const steps = [
      'Validating configuration',
      'Connecting to source',
      'Connecting to target',
      'Executing operation',
      'Finalizing'
    ];

    for (let i = 0; i < steps.length; i++) {
      if (progressCallback) {
        progressCallback(i, 0, steps[i]);
      }

      // Simulate work with progress updates
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (progressCallback) {
          progressCallback(i, progress, steps[i]);
        }
      }
    }

    return {
      success: true,
      message: 'Successfully executed tool',
      duration: 3000,
      estimate: {
        totalSizeBytes: 1024 * 1024 * 100
      },
      databases: ['test_db_1', 'test_db_2'],
      metrics: {
        'Tables migrated': 50,
        'Records processed': 10000,
        'Avg speed': '1.2MB/s'
      },
      warnings: ['Some test warnings here']
    };
  }
}

export default CommandCoordinatorMock;
