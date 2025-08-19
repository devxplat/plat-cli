import React from 'react';
import { Box, Text } from 'ink';
import { StatusMessage, Badge } from '@inkjs/ui';
import { colorPalettes } from '../theme/custom-theme.js';

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

  // Simple completion message since progress tracker already showed detailed results
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
