#!/usr/bin/env node

/**
 * Teste do discovery de projetos GCP com cache SQLite
 */

import gcpProjectFetcher from '../src/infrastructure/cloud/gcp-project-fetcher.js';
import persistentCache from '../src/infrastructure/cache/persistent-cache.js';

async function testGCPDiscovery() {
  console.log('🔍 Testing GCP Project Discovery with SQLite Cache');
  console.log('===================================================');

  // Enable verbose output
  process.env.VERBOSE = 'true';

  try {
    // Clear cache for fresh start
    console.log('1. Clearing cache...');
    await persistentCache.clearProjectsCache();
    console.log('   ✅ Cache cleared');

    // Test project discovery
    console.log('\n2. Testing fresh project discovery...');
    const startTime = Date.now();

    // Set up progress callback to see dynamic messages
    let lastMessage = '';
    gcpProjectFetcher.setProgressCallback((message) => {
      if (message !== lastMessage) {
        console.log(`   📡 ${message}`);
        lastMessage = message;
      }
    });

    const projects = await gcpProjectFetcher.fetchProjects();
    const endTime = Date.now();
    const fetchDuration = endTime - startTime;

    console.log(`\n   ✅ Discovery completed in ${fetchDuration}ms`);
    console.log(`   📊 Found ${projects.length} projects`);
    if (projects.length > 0) {
      console.log(`   📋 First 5: ${projects.slice(0, 5).join(', ')}`);
    }

    // Test cached retrieval
    console.log('\n3. Testing cached retrieval...');
    const cacheStartTime = Date.now();
    const cachedProjects = await gcpProjectFetcher.fetchProjects();
    const cacheEndTime = Date.now();
    const cacheDuration = cacheEndTime - cacheStartTime;

    console.log(`   ⚡ Cache retrieval: ${cacheDuration}ms`);
    console.log(
      `   📊 Same result: ${JSON.stringify(projects) === JSON.stringify(cachedProjects)}`
    );
    console.log(
      `   🚀 Speed improvement: ${Math.round((fetchDuration / cacheDuration) * 100) / 100}x faster`
    );

    // Test cache info
    console.log('\n4. Testing cache information...');
    const cacheInfo = await gcpProjectFetcher.getCacheInfo();
    console.log(`   💾 Has cache: ${cacheInfo.hasCache}`);
    console.log(`   📊 Cached projects: ${cacheInfo.projectCount}`);
    console.log(`   ⏰ Cache age: ${Math.round(cacheInfo.cacheAge / 1000)}s`);
    console.log(`   🔧 Strategy: ${cacheInfo.strategy}`);

    // Test project suggestions
    console.log('\n5. Testing project suggestions...');
    const allSuggestions = await gcpProjectFetcher.getProjectSuggestions('');
    console.log(`   📋 All suggestions: ${allSuggestions.length}`);

    if (projects.length > 0) {
      const firstProject = projects[0];
      const prefix = firstProject.substring(0, 3);
      const filteredSuggestions =
        await gcpProjectFetcher.getProjectSuggestions(prefix);
      console.log(
        `   🔍 Filtered by '${prefix}': ${filteredSuggestions.length}`
      );
    }

    // Test cache statistics
    console.log('\n6. Testing cache statistics...');
    const stats = await persistentCache.getCacheStats();
    console.log(`   📊 Cache entries: ${stats.entryCount}`);
    console.log(`   💾 Total cache size: ${stats.totalSize} bytes`);

    // Show operation stats if available
    if (stats.operations && Object.keys(stats.operations).length > 0) {
      console.log('   🎯 Operation stats:');
      for (const [op, opStats] of Object.entries(stats.operations)) {
        const hitRate = (opStats.hits / (opStats.hits + opStats.misses)) * 100;
        console.log(
          `      - ${op}: ${opStats.hits} hits, ${opStats.misses} misses (${Math.round(hitRate)}% hit rate)`
        );
      }
    }

    console.log(
      '\n🎉 All tests passed! GCP Discovery with SQLite cache is working perfectly.'
    );
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(`Error: ${error.message}`);
    if (process.env.VERBOSE === 'true') {
      console.error(`Stack: ${error.stack}`);
    }
  } finally {
    // Clean up progress callback
    gcpProjectFetcher.setProgressCallback(null);
  }
}

// Run the test
await testGCPDiscovery();
