import React from 'react';
import { Box, Text, useInput } from 'ink';
import { StatusMessage, Badge } from '@inkjs/ui';
import { colorPalettes } from '../theme/custom-theme.js';
import MigrationSummary from '../../common/components/MigrationSummary.js';

// Helper function to format duration
const _formatDuration = (milliseconds) => {
  if (typeof milliseconds === 'string') {
    return milliseconds; // Already formatted
  }
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Simple ExecutionResults component using React.createElement
 */
const ExecutionResults = ({ result, config, error, onContinue, onRetry, onViewLogs }) => {
  const [isActive, setIsActive] = React.useState(true);
  
  // Use Ink's useInput hook for better key handling
  useInput((input, key) => {
    // Skip in test environment or if not active
    if (process.env.NODE_ENV === 'test' || !isActive) {
      return;
    }

    // Handle different key presses
    if (key.return || input === '\r' || input === '\n') {
      // Enter key - return to menu
      if (onContinue) {
        setIsActive(false); // Disable input before transitioning
        onContinue();
      }
    } else if (input?.toLowerCase() === 'r') {
      // R - run another migration
      if (onRetry) {
        onRetry();
      } else if (onContinue) {
        onContinue(); // Fallback to menu if no retry handler
      }
    } else if (input?.toLowerCase() === 'v') {
      // V - view detailed logs
      if (onViewLogs) {
        onViewLogs();
      }
    } else if (key.escape) {
      // Escape - exit application
      process.exit(0);
    }
  });

  if (error) {
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 2 },
      React.createElement(
        StatusMessage,
        { variant: 'error' },
        `❌ Operation failed: ${error.message}`
      ),
      React.createElement(
        Box,
        { flexDirection: 'column', marginTop: 1, gap: 0 },
        React.createElement(
          Text,
          { color: '#7e9400' },
          '[Enter] Try again'
        ),
        React.createElement(
          Text,
          { color: colorPalettes.dust.tertiary },
          '[Esc] Exit application'
        )
      )
    );
  }

  if (!result) {
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        StatusMessage,
        { variant: 'info' },
        'No results to display'
      )
    );
  }

  // Check if it's a batch/interactive migration with detailed results
  const isBatchResult = result?.batchResults || config?.isBatch;
  const isInteractive = config?.metadata?.mode === 'interactive' || config?.migrationMode === 'interactive';
  
  // Format result for MigrationSummary component
  if (isBatchResult || isInteractive) {
    const batchResults = result?.batchResults || result;
    
    // Format operations for MigrationSummary
    const operations = [];
    if (batchResults?.successful) {
      batchResults.successful.forEach(item => {
        const op = item.operation || item;
        operations.push({
          status: 'success',
          config: op.config || config,
          result: op.result || item.result,
          duration: op.duration || item.duration
        });
      });
    }
    if (batchResults?.failed) {
      batchResults.failed.forEach(item => {
        const op = item.operation || item;
        operations.push({
          status: 'error',
          config: op.config || config,
          error: item.error?.message || 'Unknown error',
          result: op.result || item.result
        });
      });
    }
    
    // Handle both batch and interactive mode results
    const formattedResult = {
      operations: operations.length > 0 ? operations : (result?.operations || []),
      totalDuration: batchResults?.report?.summary?.duration || result?.duration || result?.totalDuration,
      processedDatabases: result?.processedDatabases || batchResults?.processedDatabases,
      totalSize: result?.totalSize || batchResults?.totalSize
    };
    
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 2 },
      React.createElement(MigrationSummary, {
        result: formattedResult,
        config: config,
        isBatch: true
      }),
      // Navigation options
      React.createElement(
        Box,
        { flexDirection: 'column', marginTop: 2, gap: 0 },
        React.createElement(
          Text,
          { bold: true, color: colorPalettes.dust.primary },
          'What would you like to do next?'
        ),
        React.createElement(Box, { height: 1 }),
        React.createElement(
          Text,
          { color: '#7e9400' },
          '[Enter] Return to main menu'
        ),
        React.createElement(
          Text,
          { color: colorPalettes.genericGradient[1] },
          '[R] Run another migration'
        ),
        onViewLogs && React.createElement(
          Text,
          { color: colorPalettes.genericGradient[3] },
          '[V] View detailed logs'
        ),
        React.createElement(
          Text,
          { color: colorPalettes.dust.tertiary },
          '[Esc] Exit application'
        )
      )
    );
  }
  
  // Single migration - use MigrationSummary
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 2 },
    React.createElement(MigrationSummary, {
      result: result,
      config: config,
      isBatch: false
    }),
    // Navigation options for single migration
    React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 2, gap: 0 },
      React.createElement(
        Text,
        { bold: true, color: colorPalettes.dust.primary },
        'What would you like to do next?'
      ),
      React.createElement(Box, { height: 1 }),
      React.createElement(
        Text,
        { color: '#7e9400' },
        '[Enter] Return to main menu'
      ),
      React.createElement(
        Text,
        { color: colorPalettes.genericGradient[1] },
        '[R] Run another migration'
      ),
      onViewLogs && React.createElement(
        Text,
        { color: colorPalettes.genericGradient[3] },
        '[V] View detailed logs'
      ),
      React.createElement(
        Text,
        { color: colorPalettes.dust.tertiary },
        '[Esc] Exit application'
      )
    )
  );
};

export default ExecutionResults;
