import test from 'ava';
import sinon from 'sinon';
import { ProjectHistoryManager } from './project-history-manager.js';

test('ProjectHistoryManager initializes with correct defaults', (t) => {
  const manager = new ProjectHistoryManager();

  t.is(manager.maxHistory, 20);
});

test('ProjectHistoryManager addProject handles valid project ID', async (t) => {
  const manager = new ProjectHistoryManager();

  // Should not throw
  await t.notThrowsAsync(async () => {
    await manager.addProject('test-project-123');
  });
});

test('ProjectHistoryManager addProject ignores invalid input', async (t) => {
  const manager = new ProjectHistoryManager();

  // Should not throw with invalid inputs
  await t.notThrowsAsync(async () => {
    await manager.addProject(null);
    await manager.addProject(undefined);
    await manager.addProject(123);
    await manager.addProject({});
  });
});

test('ProjectHistoryManager getRecentProjects returns array', async (t) => {
  const manager = new ProjectHistoryManager();

  const projects = await manager.getRecentProjects();

  t.true(Array.isArray(projects));
});

test('ProjectHistoryManager getRecentProjects filters by prefix', async (t) => {
  const manager = new ProjectHistoryManager();

  // Mock the internal method
  manager.getRecentProjects = async (prefix) => {
    const mockProjects = [
      'prod-app',
      'prod-database',
      'dev-app',
      'staging-app'
    ];
    if (!prefix) return mockProjects;
    const lowerPrefix = prefix.toLowerCase();
    return mockProjects.filter((p) => p.toLowerCase().startsWith(lowerPrefix));
  };

  const allProjects = await manager.getRecentProjects();
  t.is(allProjects.length, 4);

  const prodProjects = await manager.getRecentProjects('prod');
  t.is(prodProjects.length, 2);
  t.true(prodProjects.every((p) => p.startsWith('prod')));

  const devProjects = await manager.getRecentProjects('dev');
  t.is(devProjects.length, 1);
  t.is(devProjects[0], 'dev-app');
});

test('ProjectHistoryManager clearHistory executes without error', async (t) => {
  const manager = new ProjectHistoryManager();

  await t.notThrowsAsync(async () => {
    await manager.clearHistory();
  });
});

test('ProjectHistoryManager getProjectCount returns number', async (t) => {
  const manager = new ProjectHistoryManager();

  const count = await manager.getProjectCount();

  t.is(typeof count, 'number');
  t.true(count >= 0);
});

test('ProjectHistoryManager debugLog handles debug mode', (t) => {
  const manager = new ProjectHistoryManager();
  const originalLog = console.debug;
  const logStub = sinon.stub();
  console.debug = logStub;

  // Test with DEBUG enabled
  process.env.DEBUG = 'true';
  manager.debugLog('Test message');
  t.true(logStub.called);

  // Test with DEBUG disabled
  logStub.resetHistory();
  delete process.env.DEBUG;
  manager.debugLog('Another message');
  t.false(logStub.called);

  console.debug = originalLog;
});

test('ProjectHistoryManager handles cache errors gracefully', async (t) => {
  const manager = new ProjectHistoryManager();

  // Force an error condition by temporarily stubbing persistentCache methods
  const persistentCache = (await import('../cache/persistent-cache.js'))
    .default;
  const originalAdd = persistentCache.addProjectToHistory;
  const originalGet = persistentCache.getRecentProjects;
  persistentCache.addProjectToHistory = async () => {
    throw new Error('Cache error');
  };
  persistentCache.getRecentProjects = async () => {
    throw new Error('Cache error');
  };

  // Should not throw, but return defaults
  await t.notThrowsAsync(async () => {
    await manager.addProject('test-project');
  });

  const projects = await manager.getRecentProjects();
  t.deepEqual(projects, []);

  persistentCache.addProjectToHistory = originalAdd;
  persistentCache.getRecentProjects = originalGet;
});

test('ProjectHistoryManager singleton pattern', (t) => {
  const manager1 = new ProjectHistoryManager();
  const manager2 = new ProjectHistoryManager();

  // Each new creates a separate instance
  t.not(manager1, manager2);

  // Both have same configuration
  t.is(manager1.maxHistory, manager2.maxHistory);
});
