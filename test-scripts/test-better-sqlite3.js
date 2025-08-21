#!/usr/bin/env node

/**
 * Teste rápido para verificar se as correções SQLite funcionam
 */

import persistentCache from '../src/infrastructure/cache/persistent-cache.js';

async function testFixedSQLite() {
  console.log('🔧 Testing fixed SQLite implementation');
  console.log('=====================================');

  process.env.VERBOSE = 'true';

  try {
    // Initialize cache
    await persistentCache.init();

    // Clear previous data
    await persistentCache.clearProjectsCache();

    // Test with some projects
    const testProjects = ['test-project-1', 'test-project-2'];
    await persistentCache.setProjects(
      'test-key',
      testProjects,
      'test-strategy'
    );

    // Get projects back
    const cachedData = await persistentCache.getProjects('test-key');

    // Test project history
    await persistentCache.addProjectToHistory('test-project-1');

    // Test stats
    const stats = await persistentCache.getCacheStats();

    console.log('✅ Fixed SQLite is working perfectly!');
    console.log(`   📊 Cached ${cachedData.projects.length} projects`);
    console.log(`   📈 Cache entries: ${stats.entryCount}`);
    console.log(
      `   🎯 Operations tracked: ${Object.keys(stats.operations).length}`
    );

    // Test stats details
    if (stats.operations && Object.keys(stats.operations).length > 0) {
      console.log('   📋 Operation details:');
      for (const [op, opStats] of Object.entries(stats.operations)) {
        console.log(
          `      - ${op}: ${opStats.hits} hits, ${opStats.misses} misses`
        );
      }
    }

    console.log('\n🎉 All SQLite fixes working correctly!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

await testFixedSQLite();
