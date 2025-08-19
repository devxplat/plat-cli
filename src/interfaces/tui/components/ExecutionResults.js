import React from 'react';
import { Box, Text } from 'ink';
import { StatusMessage, Badge } from '@inkjs/ui';
import { colorPalettes } from '../theme/custom-theme.js';

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
  
  if (isBatchResult || isInteractive) {
    const batchResults = result?.batchResults || result;
    const successful = batchResults?.successful?.length || 0;
    const failed = batchResults?.failed?.length || 0;
    const skipped = batchResults?.skipped?.length || 0;
    const total = successful + failed + skipped;
    
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 2, padding: 2 },
      React.createElement(
        Box,
        { flexDirection: 'column', gap: 0 },
        React.createElement(
          Text,
          { color: '#FF00A7', bold: true },
          '✨ Migration Complete!'
        ),
        // Add timing information if available
        (batchResults?.report?.summary?.duration || result?.duration) && React.createElement(
          Text,
          { color: colorPalettes.dust.tertiary },
          `⏱  Duration: ${_formatDuration(batchResults?.report?.summary?.duration || result?.duration)}`
        )
      ),
      
      // Summary statistics
      React.createElement(
        Box,
        { flexDirection: 'column', gap: 1, marginTop: 1 },
        React.createElement(
          Text,
          { color: colorPalettes.dust.primary, bold: true },
          `📊 Migration Summary`
        ),
        React.createElement(
          Text,
          { color: colorPalettes.dust.secondary },
          `Total operations: ${total}`
        ),
        successful > 0 && React.createElement(
          Text,
          { color: 'green' },
          `✓ Successful: ${successful}`
        ),
        failed > 0 && React.createElement(
          Text,
          { color: 'red' },
          `✗ Failed: ${failed}`
        ),
        skipped > 0 && React.createElement(
          Text,
          { color: 'yellow' },
          `⊘ Skipped: ${skipped}`
        )
      ),
      
      // Show migration details if available
      batchResults?.successful?.length > 0 && React.createElement(
        Box,
        { flexDirection: 'column', gap: 1, marginTop: 1 },
        React.createElement(
          Text,
          { color: colorPalettes.dust.secondary, underline: true },
          'Successful migrations:'
        ),
        ...batchResults.successful.slice(0, 5).map((item, index) => {
          const operation = item.operation || item;
          const databases = operation.config?.source?.databases || 
                          operation.result?.migratedDatabases || 
                          [];
          const dbCount = Array.isArray(databases) ? databases.length : 0;
          const displayName = operation.id || 
                             `${operation.config?.source?.instance} → ${operation.config?.target?.instance}` ||
                             `Migration ${index + 1}`;
          
          return React.createElement(
            Text,
            { key: index, color: 'gray' },
            `  • ${displayName}${dbCount > 0 ? ` (${dbCount} databases)` : ''}`
          );
        }),
        batchResults.successful.length > 5 && React.createElement(
          Text,
          { color: colorPalettes.dust.tertiary },
          `  ... and ${batchResults.successful.length - 5} more`
        )
      ),
      
      // Show failed migrations if any
      batchResults?.failed?.length > 0 && React.createElement(
        Box,
        { flexDirection: 'column', gap: 1, marginTop: 1 },
        React.createElement(
          Text,
          { color: 'red', underline: true },
          'Failed migrations:'
        ),
        ...batchResults.failed.slice(0, 3).map((item, index) =>
          React.createElement(
            Box,
            { key: index, flexDirection: 'column', marginLeft: 2 },
            React.createElement(
              Text,
              { color: 'red' },
              `• ${item.operation?.id || item.id || `Migration ${index + 1}`}`
            ),
            React.createElement(
              Text,
              { color: 'gray', marginLeft: 2 },
              `  Error: ${item.error?.message || 'Unknown error'}`
            )
          )
        )
      ),
      
      React.createElement(
        Text, 
        { color: colorPalettes.dust.tertiary, marginTop: 1 }, 
        'Press any key to continue...'
      )
    );
  }
  
  // Simple completion message for single migrations
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center', paddingY: 2 },
    React.createElement(
      Text,
      { color: '#FF00A7', bold: true },
      '✨ Migration Complete!'
    ),

    React.createElement(Text, { color: colorPalettes.dust.tertiary }, 'Press any key to continue...')
  );
};

export default ExecutionResults;
