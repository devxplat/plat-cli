import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ThemeProvider } from '@inkjs/ui';
import customTheme, { colorPalettes } from './theme/custom-theme.js';
import { ShimmerSpinner } from './components/CustomSpinner.js';

import MainMenu from './components/MainMenu.js';
import ConfigurationForm from './components/ConfigurationForm.js';
import ConfigurationSummary from './components/ConfigurationSummary.js';
import ExecutionResults from './components/ExecutionResults.js';

/**
 * Main Ink application component for interactive CLI
 */
const InkApp = ({ coordinator, logger, onExit }) => {
  const [currentView, setCurrentView] = useState('menu'); // 'menu', 'configure', 'summary', 'executing', 'results', 'connection-error'
  const [navigationPath, setNavigationPath] = useState([]); // Track navigation hierarchy
  const [selectedTool, setSelectedTool] = useState(null);
  const [configuration, setConfiguration] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [executionError, setExecutionError] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  // Handle keyboard input for navigation
  useInput((input, key) => {
    // Multiple quit options for better compatibility
    // Alt+Q (works better on Linux/Mac)
    if (key.alt && input === 'q') {
      if (currentView === 'executing') {
        // Don't allow exit during execution
        return;
      }
      handleExit();
    }
    
    // Ctrl+X (more reliable on Windows)
    if (key.ctrl && input === 'x') {
      if (currentView === 'executing') {
        // Don't allow exit during execution
        return;
      }
      handleExit();
    }
    
    // Simple 'q' when in main menu (intuitive)
    if (input === 'q' && currentView === 'menu') {
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

  const handleNavigate = (newPath) => {
    setNavigationPath(newPath);
  };

  const handleToolSelected = (toolName) => {
    setSelectedTool(toolName);
    setCurrentView('configure');
  };

  const handleNavigationBack = () => {
    if (navigationPath.length > 0) {
      const newPath = navigationPath.slice(0, -1);
      setNavigationPath(newPath);
    }
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

        // The progress tracker will handle all visual feedback
        const result = await batchCoordinator.executeBatch(
          configuration.mapping,
          null // Progress callback handled internally by coordinator
        );

        // Ensure we have a valid result
        if (!result) {
          throw new Error('Batch migration returned no results');
        }

        // Ensure progress tracker is properly cleaned up
        if (coordinator.progressTracker) {
          if (typeof coordinator.progressTracker.complete === 'function') {
            coordinator.progressTracker.complete(result);
          }
        }
        
        // Wait for the progress tracker to show completion message
        // The progress tracker now delays unmounting by 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2500));

        setExecutionResult(result);
        setCurrentView('results');
      } else {
        // Switch to executing view for single migration
        setCurrentView('executing');
        
        // Execute the tool - progress tracker handles all visual feedback
        const result = await coordinator.execute(
          selectedTool,
          configuration,
          null // Progress callback handled internally by coordinator
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
    setNavigationPath([]); // Reset navigation path
    setCurrentView('menu');
  };

  const handleExit = () => {
    onExit();
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'menu':
        return React.createElement(MainMenu, {
          path: navigationPath,
          onNavigate: handleNavigate,
          onToolSelected: handleToolSelected,
          onBack: handleNavigationBack,
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
          React.createElement(ShimmerSpinner, {
            label: 'Validating connections and calculating estimates...',
            isVisible: true,
            status: 'running'
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
            React.createElement(ShimmerSpinner, {
              label: 'Initializing migration engine...',
              isVisible: true,
              status: 'running',
              compact: false
            })
          ),
          React.createElement(
            Text,
            { color: colorPalettes.dust.tertiary, marginTop: 1 },
            'Loading modules and preparing connections...'
          ),
          React.createElement(
            Text,
            { color: colorPalettes.dust.secondary },
            'This may take a few seconds...'
          )
        );

      case 'executing':
        // The progress tracker (managed by coordinator) handles all the display
        // It shows the ShimmerSpinner, progress bars, and all migration details
        // We show a simple spinner while the main progress tracker initializes
        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1 },
          React.createElement(ShimmerSpinner, {
            label: 'Starting migration...',
            isVisible: true,
            status: 'running'
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
            { color: colorPalettes.classyPalette[4], bold: true },
            '🚫 Connection Failed'
          ),
          React.createElement(
            Box,
            {
              marginY: 1,
              paddingX: 2,
              paddingY: 1,
              borderStyle: 'round',
              borderColor: colorPalettes.classyPalette[4]
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
              { color: colorPalettes.genericGradient[3], bold: true },
              'What would you like to do?'
            ),
            React.createElement(
              Box,
              { flexDirection: 'column', gap: 0, marginTop: 1 },
              React.createElement(
                Text,
                { color: '#7e9400' },
                '[R] Retry connection'
              ),
              React.createElement(
                Text,
                { color: '#7e9400' },
                '[Esc] Back to configuration'
              ),
              React.createElement(
                Text,
                { color: '#ac8500' },
                '[Ctrl+X] Quit application'
              )
            )
          )
        );

      default:
        return React.createElement(
          Text,
          { color: colorPalettes.classyPalette[4] },
          `Unknown view: ${currentView}`
        );
    }
  };

  return React.createElement(
    ThemeProvider,
    { theme: customTheme },
    React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      renderCurrentView()
    )
  );
};

export default InkApp;
