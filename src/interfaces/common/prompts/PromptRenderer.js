import React from 'react';
import { render, Box, Text } from 'ink';
import { ShimmerSpinner } from '../../tui/components/CustomSpinner.js';

/**
 * Helper class for rendering various Ink-based prompts
 * Provides utility methods for common prompt patterns
 */
class PromptRenderer {
  /**
   * Show a spinner with a message
   * @param {string} message - The loading message
   * @returns {Object} - Object with stop() method
   */
  static showSpinner(message) {
    const SpinnerComponent = () => {
      return React.createElement(
        Box,
        { flexDirection: 'row', gap: 1 },
        React.createElement(ShimmerSpinner, {
          label: message,
          isVisible: true,
          status: 'running'
        })
      );
    };

    const app = render(React.createElement(SpinnerComponent));
    
    return {
      stop: () => app.unmount()
    };
  }

  /**
   * Show a success message
   * @param {string} message - The success message
   * @param {number} duration - How long to show (ms), 0 = permanent
   */
  static showSuccess(message, duration = 2000) {
    const SuccessComponent = () => {
      return React.createElement(
        Box,
        { paddingY: 1 },
        React.createElement(
          Text,
          { color: 'green' },
          `✅ ${message}`
        )
      );
    };

    const app = render(React.createElement(SuccessComponent));
    
    if (duration > 0) {
      setTimeout(() => app.unmount(), duration);
    }
    
    return {
      stop: () => app.unmount()
    };
  }

  /**
   * Show an error message
   * @param {string} message - The error message
   * @param {number} duration - How long to show (ms), 0 = permanent
   */
  static showError(message, duration = 3000) {
    const ErrorComponent = () => {
      return React.createElement(
        Box,
        { paddingY: 1 },
        React.createElement(
          Text,
          { color: 'red' },
          `❌ ${message}`
        )
      );
    };

    const app = render(React.createElement(ErrorComponent));
    
    if (duration > 0) {
      setTimeout(() => app.unmount(), duration);
    }
    
    return {
      stop: () => app.unmount()
    };
  }

  /**
   * Show a warning message
   * @param {string} message - The warning message
   * @param {number} duration - How long to show (ms), 0 = permanent
   */
  static showWarning(message, duration = 2000) {
    const WarningComponent = () => {
      return React.createElement(
        Box,
        { paddingY: 1 },
        React.createElement(
          Text,
          { color: 'yellow' },
          `⚠️ ${message}`
        )
      );
    };

    const app = render(React.createElement(WarningComponent));
    
    if (duration > 0) {
      setTimeout(() => app.unmount(), duration);
    }
    
    return {
      stop: () => app.unmount()
    };
  }
}

export default PromptRenderer;