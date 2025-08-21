#!/usr/bin/env node

/**
 * Test script to verify migration summary display and navigation
 */

import ModernProgressTracker from './src/application/progress-tracker.js';

console.log('Testing Migration Summary Display...\n');

// Create a new progress tracker
const tracker = new ModernProgressTracker();

// Initialize with phases
tracker.init([
  'Validation',
  'Discovery', 
  'Pre-flight Checks',
  'Export',
  'Import',
  'Post-migration Validation',
  'Cleanup'
]);

// Simulate migration phases
async function simulateMigration() {
  // Validation
  tracker.startPhase('Validation', 1);
  await new Promise(resolve => setTimeout(resolve, 500));
  tracker.completePhase('All checks passed');

  // Discovery
  tracker.startPhase('Discovery', 1);
  await new Promise(resolve => setTimeout(resolve, 500));
  tracker.completePhase('3 instances found');

  // Pre-flight
  tracker.startPhase('Pre-flight Checks', 1);
  await new Promise(resolve => setTimeout(resolve, 500));
  tracker.completePhase('Ready for migration');

  // Export
  tracker.startPhase('Export', 3);
  for (let i = 1; i <= 3; i++) {
    tracker.update(i, `Exporting database_${i}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  tracker.completePhase('3 databases exported');

  // Import
  tracker.startPhase('Import', 3);
  for (let i = 1; i <= 3; i++) {
    tracker.update(i, `Importing database_${i}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  tracker.completePhase('3 databases imported');

  // Post-validation
  tracker.startPhase('Post-migration Validation', 1);
  await new Promise(resolve => setTimeout(resolve, 500));
  tracker.completePhase('All validations passed');

  // Cleanup
  tracker.startPhase('Cleanup', 1);
  await new Promise(resolve => setTimeout(resolve, 300));
  tracker.completePhase('Temporary files cleaned');

  // Complete the migration
  tracker.complete({
    processedDatabases: 3,
    totalSize: '145.3 MB',
    successful: [
      { database: 'database_1', size: '45.2 MB' },
      { database: 'database_2', size: '67.8 MB' },
      { database: 'database_3', size: '32.3 MB' }
    ],
    failed: []
  });

  // Keep running for 10 seconds to see the summary
  console.log('\nSummary should be displayed above. Waiting 10 seconds...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Cleanup
  tracker.cleanup();
  console.log('\nTest completed!');
  process.exit(0);
}

// Run the simulation
simulateMigration().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});