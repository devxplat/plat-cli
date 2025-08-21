#!/usr/bin/env node

/**
 * Test complete flow with summary
 */

import CommandCoordinator from './src/application/command-coordinator.js';
import WinstonLogger from './src/infrastructure/logging/winston-logger.js';

async function testCompleteFlow() {
  console.log('Testing complete migration flow with summary...\n');
  
  const logger = new WinstonLogger({ level: 'debug', consoleOutput: false });
  const coordinator = new CommandCoordinator(logger);
  
  // Test configuration
  const config = {
    source: {
      project: 'test-source',
      instance: 'test-instance',
      region: 'us-central1'
    },
    target: {
      project: 'test-target', 
      instance: 'test-instance',
      region: 'us-central1'
    },
    options: {
      dryRun: true,
      databases: ['test_db']
    },
    metadata: {
      executionId: 'test-' + Date.now(),
      toolName: 'gcp.cloudsql.migrate'
    }
  };

  try {
    // Initialize coordinator
    await coordinator.initialize();
    
    console.log('Starting migration simulation...\n');
    
    // Execute migration (dry run)
    const result = await coordinator.execute('gcp.cloudsql.migrate', config);
    
    console.log('\nMigration simulation completed!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    // Wait to see if summary appears
    console.log('\nWaiting 10 seconds to observe summary display...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    // Cleanup
    if (coordinator.progressTracker) {
      coordinator.progressTracker.cleanup();
    }
    process.exit(0);
  }
}

testCompleteFlow();