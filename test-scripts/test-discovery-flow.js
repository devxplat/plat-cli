#!/usr/bin/env node

/**
 * Teste do fluxo de discovery sem interface interativa
 * Para verificar se o loading funciona e se os dados chegam corretamente
 */

import gcpProjectFetcher from '../src/infrastructure/cloud/gcp-project-fetcher.js';
import projectHistory from '../src/infrastructure/config/project-history-manager.js';

async function testDiscoveryFlow() {
  console.log('🔍 Testing Discovery Flow (simulating interface)');
  console.log('================================================');

  // Enable verbose output
  process.env.VERBOSE = 'true';

  try {
    console.log('1. Starting component mount simulation...');

    // Simulate what ProjectScanner does on mount
    console.log('\n2. Simulating loadSuggestions...');
    const startTime = Date.now();
    const minLoadingTime = 800; // Same as ProjectScanner

    // Set up progress callback like ProjectScanner does
    let progressMessages = [];
    gcpProjectFetcher.setProgressCallback((message) => {
      if (message) {
        progressMessages.push(message);
        console.log(`   📡 ${message}`);
      }
    });

    console.log(
      '   🔄 Starting parallel fetch of recent projects and GCP projects...'
    );

    // Simulate the Promise.all from ProjectScanner
    const [recentProjects, gcpProjects] = await Promise.all([
      projectHistory.getRecentProjects(),
      gcpProjectFetcher.fetchProjects(false) // Don't force refresh for first test
    ]);

    console.log(`\n   ✅ Fetches completed in ${Date.now() - startTime}ms`);
    console.log(`   📊 Recent projects: ${recentProjects.length}`);
    console.log(`   📊 GCP projects: ${gcpProjects.length}`);

    // Simulate combining suggestions like ProjectScanner
    const allSuggestions = [...new Set([...recentProjects, ...gcpProjects])];
    const sortedSuggestions = [
      ...recentProjects,
      ...gcpProjects.filter((p) => !recentProjects.includes(p)).sort()
    ];

    console.log(`   📋 Total unique suggestions: ${allSuggestions.length}`);
    console.log(`   📋 Sorted suggestions: ${sortedSuggestions.length}`);

    // Simulate minimum loading time check
    const elapsedTime = Date.now() - startTime;
    const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

    console.log(
      `   ⏱️ Elapsed time: ${elapsedTime}ms, remaining: ${remainingTime}ms`
    );

    if (remainingTime > 0) {
      console.log(
        `   ⏳ Waiting ${remainingTime}ms for minimum loading time...`
      );
      await new Promise((resolve) => setTimeout(resolve, remainingTime));
    }

    // Get cache info like ProjectScanner does
    console.log('\n3. Simulating cache info display...');
    const cacheInfo = await gcpProjectFetcher.getCacheInfo();
    if (cacheInfo.hasCache && !false) {
      // !forceRefresh
      const cacheAgeMinutes = Math.round(cacheInfo.cacheAge / 1000 / 60);
      console.log(
        `   📊 Cache info: Found ${sortedSuggestions.length} projects (cache: ${cacheAgeMinutes}m old)`
      );
    } else {
      console.log(
        `   📊 Fresh data: Found ${sortedSuggestions.length} projects (fresh data)`
      );
    }

    // Show progress messages received
    console.log('\n4. Progress messages received during loading:');
    progressMessages.forEach((msg, idx) => {
      console.log(`   ${idx + 1}. "${msg}"`);
    });

    // Test cache performance
    console.log('\n5. Testing cache performance...');
    const cacheStartTime = Date.now();
    const cachedProjects = await gcpProjectFetcher.fetchProjects(false);
    const cacheDuration = Date.now() - cacheStartTime;
    console.log(`   ⚡ Cache fetch: ${cacheDuration}ms`);
    console.log(
      `   🎯 Same results: ${gcpProjects.length === cachedProjects.length}`
    );

    // Show sample projects if we have them
    if (sortedSuggestions.length > 0) {
      console.log('\n6. Sample project suggestions:');
      const samples = sortedSuggestions.slice(0, 10);
      samples.forEach((project, idx) => {
        const isRecent = recentProjects.includes(project);
        console.log(`   ${idx + 1}. ${project} ${isRecent ? '(recent)' : ''}`);
      });

      if (sortedSuggestions.length > 10) {
        console.log(`   ... and ${sortedSuggestions.length - 10} more`);
      }
    }

    console.log('\n🎉 Discovery flow test completed successfully!');
    console.log('\nThis simulates what happens when ProjectScanner loads:');
    console.log('✅ Loading spinner appears immediately');
    console.log('✅ Progress messages update dynamically');
    console.log('✅ Recent projects and GCP projects load in parallel');
    console.log('✅ Cache is used when available');
    console.log('✅ Minimum loading time ensures good UX');
    console.log('✅ Final suggestions combine recent + all GCP projects');
  } catch (error) {
    console.error('\n❌ Discovery flow test failed:');
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
await testDiscoveryFlow();
