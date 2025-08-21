#!/usr/bin/env node

/**
 * Test script for GCP Project Fetcher debugging
 * Usage: node test-gcp-projects.js
 * Debug: VERBOSE=true node test-gcp-projects.js
 */

import gcpProjectFetcher from '../src/infrastructure/cloud/gcp-project-fetcher.js';

async function testGCPProjectFetcher() {
  console.log('🔍 Testing GCP Project Fetcher with Debug Enhancements');
  console.log('======================================================');

  // Enable debug mode
  const originalVerbose = process.env.VERBOSE;
  process.env.VERBOSE = 'true';

  try {
    console.log('⏰ Starting project fetch...');
    const startTime = Date.now();

    // Clear cache to ensure fresh fetch
    await gcpProjectFetcher.clearCache();

    // Fetch projects
    const projects = await gcpProjectFetcher.fetchProjects();

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('\n✅ Results:');
    console.log(`   - Found ${projects.length} projects`);
    console.log(`   - Fetch time: ${duration}ms`);
    console.log(
      `   - Sample projects: ${projects.slice(0, 5).join(', ')}${projects.length > 5 ? '...' : ''}`
    );

    // Test cache functionality
    console.log('\n🔄 Testing cache...');
    const cacheStartTime = Date.now();
    const cachedProjects = await gcpProjectFetcher.fetchProjects();
    const cacheEndTime = Date.now();
    const cacheDuration = cacheEndTime - cacheStartTime;

    console.log(`   - Cached fetch time: ${cacheDuration}ms`);
    console.log(
      `   - Cache working: ${cacheDuration < duration ? '✅' : '❌'}`
    );
    console.log(
      `   - Same results: ${JSON.stringify(projects) === JSON.stringify(cachedProjects) ? '✅' : '❌'}`
    );

    // Test project suggestions
    console.log('\n🔍 Testing project suggestions...');
    const suggestions = await gcpProjectFetcher.getProjectSuggestions('');
    console.log(`   - All suggestions: ${suggestions.length}`);

    if (projects.length > 0) {
      const firstProject = projects[0];
      const prefix = firstProject.substring(0, 3);
      const filteredSuggestions =
        await gcpProjectFetcher.getProjectSuggestions(prefix);
      console.log(
        `   - Filtered by '${prefix}': ${filteredSuggestions.length} suggestions`
      );
    }

    console.log('\n🎉 Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
  } finally {
    // Restore original verbose setting
    if (originalVerbose !== undefined) {
      process.env.VERBOSE = originalVerbose;
    } else {
      delete process.env.VERBOSE;
    }
  }
}

// Test different scenarios
async function testErrorScenarios() {
  console.log('\n🧪 Testing Error Scenarios');
  console.log('=============================');

  const fetcher = gcpProjectFetcher;

  // Test validation
  console.log('Testing billing account ID validation:');
  console.log(
    `  - Valid ID '012345-678901-234567': ${fetcher.validateBillingAccountId('012345-678901-234567') ? '✅' : '❌'}`
  );
  console.log(
    `  - Invalid ID 'invalid-format': ${fetcher.validateBillingAccountId('invalid-format') ? '❌' : '✅'}`
  );
  console.log(
    `  - Invalid ID '': ${fetcher.validateBillingAccountId('') ? '❌' : '✅'}`
  );

  // Test error summary
  console.log('\nTesting error summary formatting:');
  const testErrors = [
    new Error('PERMISSION_DENIED: User not authorized'),
    new Error('NOT_FOUND: Resource not found'),
    new Error('API not enabled for this project'),
    new Error('Request timeout occurred'),
    new Error(
      'Some very long error message that should be truncated because it exceeds the maximum length we want to display'
    )
  ];

  testErrors.forEach((error) => {
    const summary = fetcher.getErrorSummary(error);
    console.log(`  - "${error.message}" → "${summary}"`);
  });
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Environment:', {
    VERBOSE: process.env.VERBOSE || 'false',
    DEBUG: process.env.DEBUG || 'false',
    NODE_ENV: process.env.NODE_ENV || 'development'
  });

  await testGCPProjectFetcher();
  await testErrorScenarios();
}
