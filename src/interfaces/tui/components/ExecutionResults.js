import React from 'react';
import { Box, Text } from 'ink';
import { StatusMessage, Badge } from '@inkjs/ui';

/**
 * Simple ExecutionResults component using React.createElement
 */
const ExecutionResults = ({ result, error, onContinue }) => {
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

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 2 },
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 2 },
      React.createElement(Badge, { color: 'green' }, 'SUCCESS'),
      React.createElement(
        Text,
        { bold: true, color: 'green' },
        result.message || 'Operation completed successfully'
      )
    ),

    result.databases &&
      React.createElement(
        Box,
        { flexDirection: 'column', gap: 1 },
        React.createElement(
          Text,
          { color: 'cyan' },
          `✅ Migrated ${result.databases.length} database(s):`
        ),
        React.createElement(
          Text,
          { color: 'gray' },
          result.databases.join(', ')
        )
      ),

    result.duration &&
      React.createElement(
        Box,
        { flexDirection: 'row', gap: 2 },
        React.createElement(Text, { color: 'gray' }, 'Duration:'),
        React.createElement(
          Text,
          null,
          `${Math.round(result.duration / 1000)}s`
        )
      ),

    React.createElement(Text, { color: 'gray' }, 'Press any key to continue...')
  );
};

export default ExecutionResults;
