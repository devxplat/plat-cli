import React from 'react';
import { Box, Text } from 'ink';
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
const ExecutionResults = ({ result, config, error, onContinue }) => {
  React.useEffect(() => {
    // Skip stdin listener in test environment
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const handleKeyPress = () => {
      if (onContinue) {
        onContinue();
      }
    };

    // Listen for any key press
    const handleInput = () => handleKeyPress();
    process.stdin.on('data', handleInput);

    return () => {
      process.stdin.off('data', handleInput);
    };
  }, [onContinue]);

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
        Text,
        { color: 'gray' },
        'Press any key to continue...'
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
  const isInteractive = config?.metadata?.mode === 'interactive';
  
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
    
    const formattedResult = {
      operations,
      totalDuration: batchResults?.report?.summary?.duration || result?.duration || result.totalDuration
    };
    
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 2 },
      React.createElement(MigrationSummary, {
        result: formattedResult,
        config: config,
        isBatch: true
      }),
      React.createElement(
        Text, 
        { color: colorPalettes.dust.tertiary, marginTop: 1 }, 
        'Press any key to continue...'
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
    React.createElement(
      Text,
      { color: colorPalettes.dust.tertiary, marginTop: 1 },
      'Press any key to continue...'
    )
  );
};

export default ExecutionResults;
