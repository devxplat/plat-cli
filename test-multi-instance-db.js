#!/usr/bin/env node

/**
 * Test script for multi-instance database selection
 * Tests the EnhancedInstanceSelector with multiple source instances
 */

import React from 'react';
import { render } from 'ink';
import { Box, Text } from 'ink';
import EnhancedInstanceSelector from './src/interfaces/interactiveCLI/components/EnhancedInstanceSelector.js';

// Mock instances to test with
const mockInstances = [
  {
    project: 'project-1',
    instance: 'instance-1',
    label: 'Instance 1',
    publicIp: '10.0.0.1',
    region: 'us-central1'
  },
  {
    project: 'project-1', 
    instance: 'instance-2',
    label: 'Instance 2',
    publicIp: '10.0.0.2',
    region: 'us-central1'
  },
  {
    project: 'project-2',
    instance: 'instance-3',
    label: 'Instance 3',
    publicIp: '10.0.0.3',
    region: 'us-east1'
  }
];

const TestApp = () => {
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState(null);

  const handleSubmit = (selection) => {
    console.log('\n=== Selection Result ===');
    console.log('Total Selected:', selection.totalSelected);
    console.log('Database Selection Mode:', selection.databaseSelection);
    console.log('\nInstances with databases:');
    
    selection.instances.forEach(inst => {
      console.log(`\n${inst.label || inst.instance}:`);
      console.log('  Project:', inst.project);
      console.log('  Instance:', inst.instance);
      console.log('  Databases:', inst.databases);
      console.log('  Credentials:', inst.credentials ? 'Provided' : 'Missing');
    });
    
    setResult(selection);
  };

  const handleCancel = () => {
    console.log('Selection cancelled');
    process.exit(0);
  };

  if (result) {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(
        Text,
        { color: 'green', bold: true },
        '✓ Test completed successfully!'
      ),
      React.createElement(
        Text,
        { color: 'white' },
        `Selected ${result.totalSelected} instances with database configuration`
      ),
      React.createElement(
        Box,
        { flexDirection: 'column', marginTop: 1 },
        ...result.instances.map(inst => 
          React.createElement(
            Text,
            { key: inst.instance, color: 'cyan' },
            `• ${inst.label}: ${Array.isArray(inst.databases) ? 
              `${inst.databases.length} databases` : 
              inst.databases === 'all' ? 'all databases' : 'no databases'}`
          )
        )
      )
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(
      Text,
      { color: 'yellow', bold: true },
      '🧪 Testing Multi-Instance Database Selection'
    ),
    React.createElement(
      Text,
      { color: 'gray' },
      'Select multiple instances and configure their databases individually'
    ),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(EnhancedInstanceSelector, {
        instances: mockInstances,
        onSubmit: handleSubmit,
        onCancel: handleCancel,
        allowMultiple: true,
        label: 'Test Source Instances',
        isSource: true
      })
    )
  );
};

// Run the test
const { waitUntilExit } = render(React.createElement(TestApp));

waitUntilExit().then(() => {
  console.log('\nTest finished');
  process.exit(0);
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});