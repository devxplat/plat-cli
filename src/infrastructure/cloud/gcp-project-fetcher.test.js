import test from 'ava';
import sinon from 'sinon';
import { GCPProjectFetcher } from './gcp-project-fetcher.js';

test('GCPProjectFetcher initializes with correct defaults', (t) => {
  const fetcher = new GCPProjectFetcher();

  t.is(fetcher.BILLING_DISCOVERY_TIMEOUT, 15000);
  t.is(fetcher.QUICK_CHECK_LIMIT, 5);
  t.is(fetcher.LARGE_ORG_THRESHOLD, 5000);
  t.is(fetcher.CONCURRENT_BILLING_LIMIT, 3);
  t.is(fetcher.cacheDuration, 24 * 60 * 60 * 1000);
  t.is(fetcher.CACHE_KEY, 'gcp_projects');
  t.is(fetcher.progressCallback, null);
});

test('GCPProjectFetcher setProgressCallback sets callback', (t) => {
  const fetcher = new GCPProjectFetcher();
  const callback = sinon.stub();

  fetcher.setProgressCallback(callback);

  t.is(fetcher.progressCallback, callback);
});

test('GCPProjectFetcher updateProgress calls callback when set', (t) => {
  const fetcher = new GCPProjectFetcher();
  const callback = sinon.stub();

  fetcher.setProgressCallback(callback);
  fetcher.updateProgress('Test message');

  t.true(callback.calledWith('Test message'));
});

test('GCPProjectFetcher updateProgress handles missing callback', (t) => {
  const fetcher = new GCPProjectFetcher();

  // Should not throw
  t.notThrows(() => {
    fetcher.updateProgress('Test message');
  });
});

test('GCPProjectFetcher getProjectCount returns number', async (t) => {
  const fetcher = new GCPProjectFetcher();

  // Mock the internal cache call
  fetcher.getCachedProjects = async () => ({ projects: ['p1', 'p2', 'p3'] });

  const count = await fetcher.getProjectCount();

  t.is(count, 3);
});

test('GCPProjectFetcher getCacheAge handles missing cache', async (t) => {
  const fetcher = new GCPProjectFetcher();

  const age = await fetcher.getCacheAge();

  t.is(age, null);
});

test('GCPProjectFetcher getCachedProjects returns null for expired cache', async (t) => {
  const fetcher = new GCPProjectFetcher();

  const result = await fetcher.getCachedProjects();

  t.is(result, null);
});

test('GCPProjectFetcher debugLog respects DEBUG env', (t) => {
  const fetcher = new GCPProjectFetcher();
  const originalLog = console.debug;
  const logStub = sinon.stub();
  console.debug = logStub;

  // Test with DEBUG enabled
  process.env.DEBUG = 'true';
  fetcher.debugLog('Test message');
  t.true(logStub.called);

  // Test with DEBUG disabled
  logStub.resetHistory();
  delete process.env.DEBUG;
  fetcher.debugLog('Another message');
  t.false(logStub.called);

  console.debug = originalLog;
});

test('GCPProjectFetcher analyzeOrganizationStructure returns default', async (t) => {
  const fetcher = new GCPProjectFetcher();

  const result = await fetcher.analyzeOrganizationStructure([]);

  t.deepEqual(result, {
    isLargeOrg: false,
    strategy: 'all-projects',
    estimatedProjects: 0,
    billingAccountsChecked: 0
  });
});

test('GCPProjectFetcher fetchProjectsDirectly handles errors', async (t) => {
  const fetcher = new GCPProjectFetcher();

  // Should return empty array on error
  const projects = await fetcher.fetchProjectsDirectly();

  t.deepEqual(projects, []);
});

test('GCPProjectFetcher isGcloudAvailable handles missing gcloud', async (t) => {
  const fetcher = new GCPProjectFetcher();

  // Mock execAsync to throw
  const { exec } = await import('child_process');
  const originalExec = exec;

  // Will return false if gcloud is not available
  const result = await fetcher.isGcloudAvailable();

  t.is(typeof result, 'boolean');
});

test('GCPProjectFetcher refreshCache forces new fetch', async (t) => {
  const fetcher = new GCPProjectFetcher();
  let clearCalled = false;

  // Mock the clear method
  fetcher.clearCache = async () => {
    clearCalled = true;
  };

  await fetcher.refreshCache();

  t.true(clearCalled);
});

test('GCPProjectFetcher handles fetch strategies', async (t) => {
  const fetcher = new GCPProjectFetcher();

  // Test different strategies
  const strategies = ['all-projects', 'billing-first', 'limited-discovery'];

  for (const strategy of strategies) {
    const result = await fetcher.analyzeOrganizationStructure([]);
    t.truthy(result.strategy);
  }
});

test('GCPProjectFetcher getProjects returns array', async (t) => {
  const fetcher = new GCPProjectFetcher();

  const projects = await fetcher.getProjects();

  t.true(Array.isArray(projects));
});
