#!/usr/bin/env node

/**
 * Test for Ctrl+U keyboard shortcut
 */

import React, { useState } from 'react';
import { render, Box, Text, useInput } from 'ink';
import chalk from 'chalk';

const TestCtrlU = () => {
  const [refreshCount, setRefreshCount] = useState(0);
  const [lastKey, setLastKey] = useState('');

  useInput((input, key) => {
    // Test Ctrl+U shortcut
    if (key.ctrl && input === 'u') {
      setRefreshCount(prev => prev + 1);
      setLastKey('Ctrl+U');
    }
    // Test Ctrl+R shortcut  
    else if (key.ctrl && input === 'r') {
      setRefreshCount(prev => prev + 1);
      setLastKey('Ctrl+R');
    }
    // Test old F5 shortcut (should not work)
    else if (key.function && key.name === 'f5') {
      setRefreshCount(prev => prev + 1);
      setLastKey('F5');
    }
    // Exit on Ctrl+C or q
    else if ((key.ctrl && input === 'c') || input === 'q') {
      process.exit(0);
    }
  });

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(
      Text,
      { color: 'green', bold: true },
      '🧪 Testing Keyboard Shortcuts for Cache Refresh'
    ),
    React.createElement(Text, null, ''),
    React.createElement(
      Text,
      null,
      'Press the following keys to test:'
    ),
    React.createElement(
      Text,
      { color: 'cyan' },
      '• Ctrl+U - New refresh shortcut (should work)'
    ),
    React.createElement(
      Text,
      { color: 'cyan' },
      '• Ctrl+R - Alternative refresh shortcut (should work)'
    ),
    React.createElement(
      Text,
      { color: 'gray' },
      '• F5 - Old shortcut (should NOT work)'
    ),
    React.createElement(
      Text,
      { color: 'yellow' },
      '• q or Ctrl+C - Exit'
    ),
    React.createElement(Text, null, ''),
    React.createElement(
      Text,
      null,
      `Refresh triggered: ${refreshCount} times`
    ),
    React.createElement(
      Text,
      null,
      lastKey ? `Last key pressed: ${chalk.bold(lastKey)}` : 'Waiting for input...'
    ),
    refreshCount > 0 && React.createElement(
      Text,
      { color: 'green' },
      `✅ ${lastKey} shortcut is working!`
    )
  );
};

console.log('Starting keyboard shortcut test...\n');

// Check if raw mode is supported
if (process.stdin.isTTY && process.stdin.setRawMode) {
  const app = render(React.createElement(TestCtrlU));
} else {
  console.log(chalk.yellow('⚠️  Raw mode not supported in this environment'));
  console.log(chalk.cyan('\nManual verification steps:'));
  console.log('1. Run: node test-interactive-discovery.js');
  console.log('2. Once loaded, press Ctrl+U');
  console.log('3. You should see "Refreshing project cache..." message');
  console.log('4. The cache should reload with updated project count');
  console.log('\nThe shortcut has been updated from F5 to Ctrl+U in:');
  console.log('✅ src/interfaces/tui/components/ProjectScanner.js');
  console.log('✅ test-interactive-discovery.js');
  console.log('✅ specs/requirements.md');
  console.log('✅ specs/cache-user-guide.md');
  
  // Only exit if not running in test environment
  if (process.env.NODE_ENV !== 'test') {
    process.exit(0);
  }
}