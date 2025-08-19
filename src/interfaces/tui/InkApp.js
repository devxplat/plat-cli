import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ThemeProvider, defaultTheme, Spinner } from '@inkjs/ui';

import MainMenu from './components/MainMenu.js';
import ConfigurationForm from './components/ConfigurationForm.js';
import ConfigurationSummary from './components/ConfigurationSummary.js';
import ProgressDisplay, {
  MultiStepProgress
} from './components/ProgressDisplay.js';
import ExecutionResults from './components/ExecutionResults.js';

/**
 * Main Ink application component for interactive CLI
 */
const InkApp = ({ coordinator, logger, onExit }) => {
  const [currentView, setCurrentView] = useState('menu'); // 'menu', 'configure', 'summary', 'executing', 'results', 'connection-error'
  const [selectedTool, setSelectedTool] = useState(null);
  const [configuration, setConfiguration] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionError, setExecutionError] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [executionProgress, setExecutionProgress] = useState({
    steps: [],
    currentStep: 0,
    currentProgress: 0
  });

  // Handle keyboard input for navigation
  useInput((input, key) => {
    // Alt+Q to quit application (safer than Ctrl+Q which conflicts with Cursor/VSCode)
    if (key.alt && input === 'q') {
      if (currentView === 'executing') {
        // Don't allow exit during execution
        return;
      }
      handleExit();
    }

    // Escape key for back/cancel navigation (only for views that don't have local handlers)
    if (key.escape) {
      switch (currentView) {
        case 'summary':
          handleBackToConfiguration(); // Go back to configuration form keeping data
          break;
        case 'results':
          handleBackToMenu();
          break;
        case 'connection-error':
          handleBackToConfiguration(); // Go back to first step of configuration keeping all data
          break;
        // Don't handle escape in 'configure' - let ConfigurationForm handle step-by-step navigation
        // Don't handle escape in menu (would be confusing) or executing (dangerous)
      }
    }

    // Handle retry on connection error screen
    if (currentView === 'connection-error') {
      if (input?.toLowerCase() === 'r') {
        handleRetryConnection();
      }
    }

    // Handle any key press on results screen
    if (currentView === 'results' && input) {
      handleBackToMenu();
    }
  });

  const handleToolSelected = (toolName) => {
    setSelectedTool(toolName);
    setCurrentView('configure');
  };

  const handleConfigurationComplete = async (config) => {
    setConfiguration(config);
    setCurrentView('validating'); // Start validation before showing summary

    try {
      // Check if it's a batch configuration
      if (config?.isBatch && config?.mapping) {
        // For batch migrations, validate the mapping
        const validation = config.mapping.validate();
        if (!validation.valid) {
          throw new Error(`Invalid mapping: ${validation.errors.join(', ')}`);
        }
        
        // If validation passed, show summary
        setCurrentView('summary');
      } else {
        // Perform REAL validation before showing summary
        const toolName = config?.metadata?.toolName;

        if (toolName && coordinator) {
          const availableTools = coordinator.getAvailableTools();
          const tool = availableTools.find((t) => t.name === toolName);

          if (tool && tool.validate) {
            // Perform REAL connection validation using the tool's validate method
            await tool.validate(config);
          }
        }

        // If validation passed, show summary
        setCurrentView('summary');
      }
    } catch (err) {
      // If validation failed, show connection error
      handleConnectionError(err);
    }
  };

  const handleConfigurationCancel = () => {
    setSelectedTool(null);
    setConfiguration(null);
    setCurrentView('menu');
  };

  const handleExecutionConfirm = () => {
    // Show loading state immediately for user feedback
    setCurrentView('initializing');
    setExecutionResult(null);
    setExecutionError(null);
    setConnectionError(null);

    // Use setTimeout to allow React to render the loading state before heavy work
    setTimeout(async () => {
      await executeAfterLoading();
    }, 50);
  };

  const executeAfterLoading = async () => {
    try {
      // Check if it's a batch configuration
      if (configuration?.isBatch && configuration?.mapping) {
        // Set up batch progress tracking
        const progressSteps = [
          'Initialization',
          'Validation',
          'Execution',
          'Consolidation',
          'Reporting'
        ];

        setExecutionProgress({
          steps: progressSteps,
          currentStep: 0,
          currentProgress: 0
        });

        // Create progress callback for batch
        const progressCallback = (progress) => {
          const stepIndex = progressSteps.indexOf(progress.phase) || 0;
          setExecutionProgress({
            steps: progressSteps,
            currentStep: stepIndex,
            currentProgress: progress.current || 0,
            total: progress.total || 100,
            status: progress.status
          });
        };

        // Now load the module and switch to executing view
        const { default: BatchMigrationCoordinator } = await import(
          '../../application/batch-migration-coordinator.js'
        );
        
        // Switch to executing view after module is loaded
        setCurrentView('executing');
        
        const batchCoordinator = new BatchMigrationCoordinator({
          coordinator,
          logger,
          maxParallel: configuration.mapping.options?.maxParallel || 3,
          stopOnError: configuration.mapping.options?.stopOnError !== false,
          retryFailed: true
        });

        const result = await batchCoordinator.executeBatch(
          configuration.mapping,
          progressCallback
        );

        setExecutionResult(result);
        setCurrentView('results');
      } else {
        // Switch to executing view for single migration
        setCurrentView('executing');
        
        // Set up single migration progress tracking
        const progressSteps = [
          'Validating configuration',
          'Connecting to source',
          'Connecting to target',
          'Executing operation',
          'Finalizing'
        ];

        setExecutionProgress({
          steps: progressSteps,
          currentStep: 0,
          currentProgress: 0
        });

        // Create progress callback
        const progressCallback = (step, progress) => {
          setExecutionProgress((prev) => ({
            ...prev,
            currentStep: step,
            currentProgress: progress
          }));
        };

        // Execute the tool
        const result = await coordinator.execute(
          selectedTool,
          configuration,
          progressCallback
        );

        setExecutionResult(result);
        setCurrentView('results');
      }
    } catch (error) {
      logger?.error('Tool execution failed', {
        toolName: selectedTool,
        error: error.message,
        stack: error.stack
      });

      // Check if it's a connection error
      if (
        error.message &&
        (error.message.includes('Falha ao conectar') ||
          error.message.includes('Connection failed') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('timeout') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('connect') ||
          error.message.includes('tentativas'))
      ) {
        handleConnectionError(error);
      } else {
        setExecutionError(error);
        setCurrentView('results');
      }
    }
  };


  const handleBackToConfiguration = () => {
    // Go back to configuration form, keeping all the data that was already filled
    setCurrentView('configure');
    // Don't reset selectedTool or configuration - keep existing data
  };

  const handleConnectionError = (error) => {
    setConnectionError(error);
    setCurrentView('connection-error');
  };

  const handleRetryConnection = () => {
    setConnectionError(null);
    setCurrentView('summary'); // Go back to summary to try again
  };

  const handleBackToMenu = () => {
    setSelectedTool(null);
    setConfiguration(null);
    setExecutionResult(null);
    setExecutionError(null);
    setConnectionError(null);
    setCurrentView('menu');
  };

  const handleExit = () => {
    onExit();
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'menu':
        return React.createElement(MainMenu, {
          coordinator: coordinator,
          onToolSelected: handleToolSelected,
          onExit: handleExit
        });

      case 'configure':
        return React.createElement(ConfigurationForm, {
          toolName: selectedTool,
          onComplete: handleConfigurationComplete,
          onCancel: handleConfigurationCancel
        });

      case 'validating':
        return React.createElement(
          Box,
          { flexDirection: 'row', gap: 1, padding: 2 },
          React.createElement(Spinner, {
            label: 'Validating connections and calculating estimates...'
          })
        );

      case 'summary':
        return React.createElement(ConfigurationSummary, {
          key: 'config-summary', // Prevent React from creating multiple instances
          config: configuration,
          coordinator: coordinator,
          onConfirm: handleExecutionConfirm,
          onCancel: handleBackToConfiguration // Go back to configuration form keeping data
        });

      case 'initializing':
        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1, padding: 2, alignItems: 'center', justifyContent: 'center' },
          React.createElement(
            Box,
            { flexDirection: 'row', gap: 1 },
            React.createElement(Spinner, {
              label: 'Initializing migration engine...'
            })
          ),
          React.createElement(
            Text,
            { color: 'gray', dimColor: true, marginTop: 1 },
            'Loading modules and preparing connections...'
          ),
          React.createElement(
            Text,
            { color: 'cyan', dimColor: true },
            'This may take a few seconds...'
          )
        );

      case 'executing':
        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 2, padding: 1 },
          React.createElement(
            Text,
            { bold: true, color: 'cyan' },
            `🚀 Executing ${selectedTool}`
          ),
          React.createElement(MultiStepProgress, {
            steps: executionProgress.steps,
            currentStep: executionProgress.currentStep,
            currentProgress: executionProgress.currentProgress
          }),
          React.createElement(ProgressDisplay, {
            isActive: true,
            progress: executionProgress.currentProgress,
            message:
              executionProgress.steps[executionProgress.currentStep] ||
              'Processing',
            status: 'running',
            compact: false
          })
        );

      case 'results':
        return React.createElement(ExecutionResults, {
          result: executionResult,
          config: configuration,
          error: executionError,
          onContinue: handleBackToMenu
        });

      case 'connection-error':
        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1, padding: 2 },
          React.createElement(
            Text,
            { color: 'red', bold: true },
            '🚫 Connection Failed'
          ),
          React.createElement(
            Box,
            {
              marginY: 1,
              paddingX: 2,
              paddingY: 1,
              borderStyle: 'round',
              borderColor: 'red'
            },
            React.createElement(
              Text,
              { color: 'white' },
              connectionError?.message || 'Unknown connection error'
            )
          ),
          React.createElement(
            Box,
            { flexDirection: 'column', gap: 1, marginTop: 1 },
            React.createElement(
              Text,
              { color: 'yellow', bold: true },
              'What would you like to do?'
            ),
            React.createElement(
              Box,
              { flexDirection: 'column', gap: 0, marginTop: 1 },
              React.createElement(
                Text,
                { color: 'cyan' },
                '[R] Retry connection'
              ),
              React.createElement(
                Text,
                { color: 'blue' },
                '[Esc] Back to configuration'
              ),
              React.createElement(
                Text,
                { color: 'gray' },
                '[Alt+Q] Quit application'
              )
            )
          )
        );

      default:
        return React.createElement(
          Text,
          { color: 'red' },
          `Unknown view: ${currentView}`
        );
    }
  };

  return React.createElement(
    ThemeProvider,
    { theme: defaultTheme },
    React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      renderCurrentView()
    )
  );
};

export default InkApp;
