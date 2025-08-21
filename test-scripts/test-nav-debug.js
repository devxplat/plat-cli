#!/usr/bin/env node

import {
  getNavigationItems,
  getNavigationStructure
} from '../src/domain/navigation/navigation-registry.js';

console.log(
  'Navigation Structure:',
  JSON.stringify(getNavigationStructure(), null, 2)
);
console.log('\nRoot Navigation Items:');
const rootItems = getNavigationItems([]);
console.log(rootItems);

console.log('\nGCP Navigation Items:');
const gcpItems = getNavigationItems(['gcp']);
console.log(gcpItems);

// Test NavigationMenu rendering
import React from 'react';
import { render, Box, Text } from 'ink';
import SimpleSelect from '../src/interfaces/interactiveCLI/components/SimpleSelect.js';

const TestApp = () => {
  const options = [
    { label: '☁️ Google Cloud Platform', value: 'gcp' },
    { label: 'Exit', value: 'exit' }
  ];

  const handleSubmit = (value) => {
    console.log('\nSelected:', value);
    process.exit(0);
  };

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    React.createElement(Text, { color: 'green' }, '🚀 Testing SimpleSelect'),
    React.createElement(SimpleSelect, {
      options: options,
      onSubmit: handleSubmit,
      defaultValue: null
    })
  );
};

// Check if TTY is available
if (process.stdin.isTTY && process.stdin.setRawMode) {
  console.log('\n--- Testing SimpleSelect Component ---\n');
  render(React.createElement(TestApp));
} else {
  console.log('\n⚠️  Cannot test interactive components - TTY not available');
}
