#!/usr/bin/env node

import React from 'react';
import { render, Box, Text } from 'ink';
import CredentialsConfiguration from '../src/interfaces/interactiveCLI/components/CredentialsConfiguration.js';

const TestApp = () => {
  const [result, setResult] = React.useState(null);

  const testInstances = [
    { project: 'test-project-1', instance: 'db-source-1', isSource: true },
    { project: 'test-project-2', instance: 'db-target-1', isSource: false }
  ];

  const handleComplete = (config) => {
    setResult(config);
    setTimeout(() => process.exit(0), 2000);
  };

  const handleCancel = () => {
    console.log('Cancelled!');
    process.exit(0);
  };

  if (result) {
    return React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(
        Text,
        { color: 'green' },
        '✅ Configuration Complete!'
      ),
      React.createElement(Text, null, `Mode: ${result.mode}`),
      React.createElement(Text, null, `Message: ${result.message}`),
      React.createElement(
        Text,
        null,
        `Credentials: ${JSON.stringify(result.credentials, null, 2)}`
      )
    );
  }

  return React.createElement(CredentialsConfiguration, {
    instances: testInstances,
    migrationMode: 'single',
    onComplete: handleComplete,
    onCancel: handleCancel
  });
};

// Only render if stdin supports raw mode
if (process.stdin.isTTY) {
  render(React.createElement(TestApp));
} else {
  console.log('❌ This test requires an interactive terminal (TTY)');
  console.log(
    'Please run this script directly in a terminal, not through a pipe or redirection.'
  );
  process.exit(1);
}
