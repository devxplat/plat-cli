import React from 'react';
import { render } from 'ink-testing-library';
import EnhancedInstanceSelector from './src/interfaces/interactiveCLI/components/EnhancedInstanceSelector.js';

// Mock ConnectionManager
const mockDatabases = [
  { name: 'production_db', sizeBytes: 1024000, sizeFormatted: '1.0 MB' },
  { name: 'staging_db', sizeBytes: 512000, sizeFormatted: '512 KB' },
  { name: 'test_db', sizeBytes: 256000, sizeFormatted: '256 KB' }
];

// Mock the module
import { jest } from '@jest/globals';
jest.unstable_mockModule('./src/infrastructure/cloud/gcp-connection-manager.js', () => ({
  default: class MockConnectionManager {
    constructor(logger) {
      this.logger = logger;
    }
    
    async listDatabases(project, instance, isSource, connectionInfo) {
      console.log('Mock listDatabases called with:', { project, instance, isSource });
      // Simulate successful database fetch
      return mockDatabases;
    }
    
    async closeConnection(project, instance, database) {
      console.log('Mock closeConnection called');
      return true;
    }
  }
}));

async function testEnhancedSelector() {
  console.log('Testing EnhancedInstanceSelector with database fetch...');
  
  const testInstances = [
    {
      project: 'test-project',
      instance: 'test-instance-1',
      publicIp: '192.168.1.1',
      ip: '10.0.0.1',
      databases: ['db1', 'db2'],
      sizeBytes: 1024000
    },
    {
      project: 'test-project',
      instance: 'test-instance-2',
      publicIp: '192.168.1.2',
      ip: '10.0.0.2',
      databases: ['db3'],
      sizeBytes: 512000
    }
  ];

  const handleSubmit = (config) => {
    console.log('✅ Submitted configuration:', JSON.stringify(config, null, 2));
  };

  const handleCancel = () => {
    console.log('Cancelled');
  };

  const { lastFrame } = render(
    React.createElement(EnhancedInstanceSelector, {
      instances: testInstances,
      onSubmit: handleSubmit,
      onCancel: handleCancel,
      allowMultiple: false,
      label: 'Select Source Instance',
      isSource: true,
      initialSelections: [],
      initialCredentials: {},
      initialCredentialsMode: 'individual'
    })
  );

  console.log('Component rendered. Last frame:');
  console.log(lastFrame());
}

// Run test
testEnhancedSelector().catch(console.error);