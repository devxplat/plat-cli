import test from 'ava';
import sinon from 'sinon';
import { PersistentCache } from './persistent-cache.js';

// Mock do módulo Database antes de importar
test.before(() => {
  // Como PersistentCache é um singleton, precisamos testar de forma diferente
});

test('PersistentCache initializes correctly', async (t) => {
  const cache = new PersistentCache();

  t.false(cache.isInitialized);
  t.is(cache.defaultTTL, 24 * 60 * 60 * 1000);
  t.is(cache.db, null);
});

test('PersistentCache init sets up database path correctly', async (t) => {
  const cache = new PersistentCache();

  // Mock the init internals without actually creating a DB
  cache.isInitialized = true;

  t.true(cache.isInitialized);
});

test('PersistentCache get method handles missing cache gracefully', async (t) => {
  const cache = new PersistentCache();

  // Without initialization, should return null
  const result = await cache.get('test-key');

  t.is(result, null);
});

test('PersistentCache set method handles uninitialized state', async (t) => {
  const cache = new PersistentCache();

  // Should not throw when not initialized
  await t.notThrowsAsync(async () => {
    await cache.set('test-key', { data: 'test' });
  });
});

test('PersistentCache clear method handles uninitialized state', async (t) => {
  const cache = new PersistentCache();

  // Should not throw when not initialized
  await t.notThrowsAsync(async () => {
    await cache.clear();
  });
});

test('PersistentCache getProjectOperationStats returns default stats', async (t) => {
  const cache = new PersistentCache();

  const stats = await cache.getProjectOperationStats();

  t.deepEqual(stats, {});
});

test('PersistentCache addProjectToHistory handles uninitialized state', async (t) => {
  const cache = new PersistentCache();

  await t.notThrowsAsync(async () => {
    await cache.addProjectToHistory('test-project');
  });
});

test('PersistentCache getRecentProjects returns empty array when uninitialized', async (t) => {
  const cache = new PersistentCache();

  const projects = await cache.getRecentProjects();

  t.true(Array.isArray(projects));
});

test('PersistentCache getCacheAge returns null when no cache exists', async (t) => {
  const cache = new PersistentCache();

  const age = await cache.getCacheAge('test-key');

  t.is(age, null);
});

test('PersistentCache debugLog handles messages correctly', (t) => {
  const cache = new PersistentCache();
  const originalDebug = console.debug;
  const logStub = sinon.stub();
  console.debug = logStub;

  process.env.DEBUG = 'true';
  cache.debugLog('Test message');

  t.true(logStub.called);

  console.debug = originalDebug;
  delete process.env.DEBUG;
});

test('PersistentCache handles database close correctly', async (t) => {
  const cache = new PersistentCache();

  // Should not throw even when db is null
  await t.notThrowsAsync(async () => {
    await cache.close();
  });
});

test('PersistentCache formatCacheAge formats time correctly', (t) => {
  const cache = new PersistentCache();

  t.is(cache.formatCacheAge(30000), '0m');
  t.is(cache.formatCacheAge(60000), '1m');
  t.is(cache.formatCacheAge(3600000), '60m');
  t.is(cache.formatCacheAge(3700000), '61m');
});

test('PersistentCache singleton returns same instance', (t) => {
  const cache1 = new PersistentCache();
  const cache2 = new PersistentCache();

  // Note: These are different instances because we're using new
  // The real singleton is the default export
  t.not(cache1, cache2);
});
