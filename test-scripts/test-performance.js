#!/usr/bin/env node

/**
 * Performance Test for Optimized GCP Project Fetcher
 * Usage: node test-performance.js
 * Debug: VERBOSE=true node test-performance.js
 */

import gcpProjectFetcher from '../src/infrastructure/cloud/gcp-project-fetcher.js';

async function testPerformanceOptimizations() {
  console.log('🚀 Testing GCP Project Fetcher - Performance Optimized Version');
  console.log('=============================================================');

  // Enable debug mode
  const originalVerbose = process.env.VERBOSE;
  process.env.VERBOSE = 'true';

  try {
    console.log('⏱️  Starting performance test...');
    const startTime = Date.now();

    // Set up progress callback to see dynamic updates
    let progressUpdates = [];
    gcpProjectFetcher.setProgressCallback((message) => {
      const timestamp = Date.now() - startTime;
      progressUpdates.push({ timestamp, message });
      console.log(`   📋 [${timestamp}ms] ${message}`);
    });

    // Clear cache to ensure fresh fetch
    gcpProjectFetcher.clearCache();

    console.log('\n🔄 Testing strategy determination...');

    // Fetch projects with optimizations
    const projects = await gcpProjectFetcher.fetchProjects();

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log('\n✅ Performance Results:');
    console.log('========================');
    console.log(`   📊 Total fetch time: ${totalDuration}ms`);
    console.log(`   📁 Projects found: ${projects.length}`);
    console.log(`   ⚡ Progress updates: ${progressUpdates.length}`);
    console.log(
      `   🔄 Cache status: ${gcpProjectFetcher.cache ? 'Populated' : 'Empty'}`
    );

    if (projects.length > 0) {
      console.log(
        `   📝 Sample projects: ${projects.slice(0, 5).join(', ')}${projects.length > 5 ? '...' : ''}`
      );
    }

    console.log('\n📋 Progress Timeline:');
    progressUpdates.forEach((update) => {
      console.log(
        `   ${String(update.timestamp).padStart(6)}ms - ${update.message}`
      );
    });

    // Test cache performance
    console.log('\n🏃 Testing cache performance...');
    const cacheStartTime = Date.now();
    const cachedProjects = await gcpProjectFetcher.fetchProjects();
    const cacheEndTime = Date.now();
    const cacheDuration = cacheEndTime - cacheStartTime;

    console.log(`   ⚡ Cached fetch time: ${cacheDuration}ms`);
    console.log(
      `   ✅ Cache speedup: ${Math.round(totalDuration / cacheDuration)}x faster`
    );
    console.log(
      `   🎯 Results match: ${JSON.stringify(projects) === JSON.stringify(cachedProjects) ? '✅' : '❌'}`
    );

    // Performance analysis
    console.log('\n📈 Performance Analysis:');
    if (totalDuration < 15000) {
      console.log('   🎉 EXCELLENT: Under 15 seconds');
    } else if (totalDuration < 30000) {
      console.log('   ✅ GOOD: Under 30 seconds');
    } else if (totalDuration < 60000) {
      console.log('   ⚠️  ACCEPTABLE: Under 60 seconds');
    } else {
      console.log('   ❌ SLOW: Over 60 seconds - needs optimization');
    }

    // Strategy analysis
    const strategyMessages = progressUpdates.filter(
      (u) =>
        u.message.includes('strategy') ||
        u.message.includes('billing') ||
        u.message.includes('fallback')
    );

    if (strategyMessages.length > 0) {
      console.log('\n🎯 Strategy Analysis:');
      strategyMessages.forEach((msg) => {
        console.log(`   ${msg.message}`);
      });
    }

    console.log('\n🎊 Performance test completed successfully!');
  } catch (error) {
    console.error('\n❌ Performance test failed:');
    console.error(`   Error: ${error.message}`);
    if (process.env.VERBOSE === 'true') {
      console.error(`   Stack: ${error.stack}`);
    }
  } finally {
    // Restore original verbose setting and clear callback
    if (originalVerbose !== undefined) {
      process.env.VERBOSE = originalVerbose;
    } else {
      delete process.env.VERBOSE;
    }
    gcpProjectFetcher.setProgressCallback(null);
  }
}

// Test concurrent processing
async function testConcurrentProcessing() {
  console.log('\n⚡ Testing Concurrent Processing Capabilities');
  console.log('============================================');

  const fetcher = gcpProjectFetcher;

  // Test billing account validation
  console.log('\n🔍 Testing billing account ID validation:');
  const testIds = [
    '012345-678901-234567', // Valid
    'ABCDEF-123456-789012', // Valid
    'invalid-format', // Invalid
    '123-456-789', // Invalid (too short)
    '', // Invalid (empty)
    'G12345-678901-234567' // Invalid (starts with letter)
  ];

  testIds.forEach((id) => {
    const isValid = fetcher.validateBillingAccountId(id);
    const status = isValid ? '✅ VALID' : '❌ INVALID';
    console.log(`   ${status}: "${id}"`);
  });

  // Test error categorization
  console.log('\n📊 Testing error categorization:');
  const testErrors = [
    new Error('PERMISSION_DENIED: User not authorized to access billing'),
    new Error('NOT_FOUND: Billing account not found'),
    new Error('The Cloud Billing API has not been enabled for this project'),
    new Error('Request timeout occurred after 30 seconds'),
    new Error('Network error: Unable to connect to googleapis.com'),
    new Error(
      'Some very long error message that should be truncated because it exceeds the maximum length we want to display in logs and user interfaces'
    )
  ];

  testErrors.forEach((error) => {
    const summary = fetcher.getErrorSummary(error);
    console.log(`   "${error.message.substring(0, 50)}..." → "${summary}"`);
  });
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🌟 Environment:', {
    VERBOSE: process.env.VERBOSE || 'false',
    DEBUG: process.env.DEBUG || 'false',
    NODE_ENV: process.env.NODE_ENV || 'development',
    Platform: process.platform,
    NodeVersion: process.version
  });

  console.log('\n🎯 Expected Performance Improvements:');
  console.log('   • Parallel billing account processing');
  console.log('   • Smart timeout logic (15s max for billing discovery)');
  console.log('   • Strategy-based approach selection');
  console.log('   • Dynamic progress updates');
  console.log('   • Controlled concurrency (max 3 simultaneous queries)');

  await testPerformanceOptimizations();
  await testConcurrentProcessing();
}
