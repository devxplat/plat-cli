import React from 'react';
import { render } from 'ink';

/**
 * Interactive CLI Interface
 * Modern TUI interface using Ink and @inkjs/ui components
 */
class InteractiveCLI {
  constructor(options = {}) {
    this.coordinator = options.coordinator;
    this.logger = options.logger;
    this.preselectedTool = options.preselectedTool;
    this.app = null;
  }

  /**
   * Start the interactive CLI
   */
  async start() {
    try {
      const handleExit = () => {
        if (this.app) {
          this.app.unmount();
        }
      };

      // Dynamically import the InkApp component
      const { default: InkApp } = await import('./InkApp.js');

      // Render the Ink app
      this.app = render(
        React.createElement(InkApp, {
          coordinator: this.coordinator,
          logger: this.logger,
          onExit: handleExit
        })
      );

      // Handle process termination
      process.on('SIGINT', handleExit);
      process.on('SIGTERM', handleExit);

      // Return a promise that resolves when the app exits
      return new Promise((resolve) => {
        const originalHandleExit = handleExit;
        const newHandleExit = () => {
          originalHandleExit();
          resolve();
        };

        // Update the exit handler
        this.app.onExit = newHandleExit;
      });
    } catch (error) {
      this.logger?.error('Interactive CLI error', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Stop the interactive CLI
   */
  async stop() {
    if (this.app) {
      this.app.unmount();
      this.app = null;
    }
  }
}

export default InteractiveCLI;
