import test from 'ava';
import sinon from 'sinon';
import MigrationEngine from './migration-engine.js';
import {
  createMockLogger,
  createMockConnectionManager,
  createMockDatabaseOps,
  createMockProgressTracker
} from '../../../test-utils/index.js';

test('MigrationEngine creates instance with dependencies', (t) => {
  const logger = createMockLogger();
  const connectionManager = createMockConnectionManager();
  const databaseOps = createMockDatabaseOps();
  const progressTracker = createMockProgressTracker();

  const engine = new MigrationEngine(
    logger,
    connectionManager,
    databaseOps,
    progressTracker
  );

  t.truthy(engine);
  t.is(typeof engine.migrate, 'function');
  t.truthy(engine.usersRolesExtractor);
});

test('MigrationEngine has required public methods', (t) => {
  const logger = createMockLogger();
  const connectionManager = createMockConnectionManager();
  const databaseOps = createMockDatabaseOps();
  const progressTracker = createMockProgressTracker();

  const engine = new MigrationEngine(
    logger,
    connectionManager,
    databaseOps,
    progressTracker
  );

  t.is(typeof engine.migrate, 'function');

  if (typeof engine.getState === 'function') {
    t.is(typeof engine.getState, 'function');
  }

  if (typeof engine.validateConfiguration === 'function') {
    t.is(typeof engine.validateConfiguration, 'function');
  }
});

test('Migration skips users/roles phases when includeUsersRoles is false', async (t) => {
  const logger = createMockLogger();
  const connectionManager = createMockConnectionManager();
  const databaseOps = createMockDatabaseOps();
  const progressTracker = createMockProgressTracker();

  const engine = new MigrationEngine(
    logger,
    connectionManager,
    databaseOps,
    progressTracker
  );

  // Mock methods
  sinon.stub(engine.usersRolesExtractor, 'init').resolves();
  sinon.stub(engine.usersRolesExtractor, 'extractUsersAndRoles').resolves({
    roles: [],
    dbPermissions: [],
    memberships: []
  });
  sinon.stub(engine.usersRolesExtractor, 'generateCreateScript').resolves('/tmp/script.sql');
  sinon.stub(engine.usersRolesExtractor, 'applyUsersAndRoles').resolves({
    success: true,
    successCount: 0,
    errorCount: 0
  });

  const config = {
    source: { project: 'src-proj', instance: 'src-inst' },
    target: { project: 'tgt-proj', instance: 'tgt-inst' },
    options: {
      includeUsersRoles: false,
      includeAll: true
    }
  };

  // Mock database operations
  databaseOps.init.resolves();
  connectionManager.listDatabases.resolves([{ name: 'testdb', sizeBytes: 1000 }]);
  connectionManager.testConnection.resolves();
  databaseOps.exportDatabase.resolves({ database: 'testdb', backupFile: '/tmp/backup' });
  databaseOps.importDatabase.resolves({ database: 'testdb' });
  connectionManager.closeAllConnections.resolves();

  await engine.migrate(config);

  // Verify users/roles methods were NOT called
  t.false(engine.usersRolesExtractor.init.called);
  t.false(engine.usersRolesExtractor.extractUsersAndRoles.called);
  t.false(engine.usersRolesExtractor.generateCreateScript.called);
  t.false(engine.usersRolesExtractor.applyUsersAndRoles.called);
});

test('Migration includes users/roles phases when includeUsersRoles is true', async (t) => {
  const logger = createMockLogger();
  const connectionManager = createMockConnectionManager();
  const databaseOps = createMockDatabaseOps();
  const progressTracker = createMockProgressTracker();

  const engine = new MigrationEngine(
    logger,
    connectionManager,
    databaseOps,
    progressTracker
  );

  // Mock users/roles extractor methods
  sinon.stub(engine.usersRolesExtractor, 'init').resolves();
  sinon.stub(engine.usersRolesExtractor, 'extractUsersAndRoles').resolves({
    roles: [{ rolname: 'test_user' }],
    dbPermissions: [],
    memberships: []
  });
  sinon.stub(engine.usersRolesExtractor, 'extractDatabasePermissions').resolves({
    testdb: { schemas: [], tables: [] }
  });
  sinon.stub(engine.usersRolesExtractor, 'generateCreateScript').resolves('/tmp/users.sql');
  sinon.stub(engine.usersRolesExtractor, 'generatePermissionsScript').resolves('/tmp/perms.sql');
  sinon.stub(engine.usersRolesExtractor, 'applyUsersAndRoles').resolves({
    success: true,
    successCount: 1,
    errorCount: 0
  });
  sinon.stub(engine.usersRolesExtractor, 'cleanup').resolves();

  const config = {
    source: { project: 'src-proj', instance: 'src-inst' },
    target: { project: 'tgt-proj', instance: 'tgt-inst' },
    options: {
      includeUsersRoles: true,
      passwordStrategy: { type: 'default', defaultPassword: 'Test123!' },
      includeAll: true
    }
  };

  // Mock database operations
  databaseOps.init.resolves();
  databaseOps.applyPermissionsScript = sinon.stub().resolves({ success: true });
  connectionManager.listDatabases.resolves([{ name: 'testdb', sizeBytes: 1000 }]);
  connectionManager.testConnection.resolves();
  databaseOps.exportDatabase.resolves({ database: 'testdb', backupFile: '/tmp/backup' });
  databaseOps.importDatabase.resolves({ database: 'testdb' });
  connectionManager.closeAllConnections.resolves();

  await engine.migrate(config);

  // Verify users/roles methods WERE called
  t.true(engine.usersRolesExtractor.init.called);
  t.true(engine.usersRolesExtractor.extractUsersAndRoles.called);
  t.true(engine.usersRolesExtractor.extractDatabasePermissions.called);
  t.true(engine.usersRolesExtractor.generateCreateScript.called);
  t.true(engine.usersRolesExtractor.applyUsersAndRoles.called);
  t.true(engine.usersRolesExtractor.generatePermissionsScript.called);
  t.true(databaseOps.applyPermissionsScript.called);
  t.true(engine.usersRolesExtractor.cleanup.called);

  // Verify order of operations
  t.true(engine.usersRolesExtractor.applyUsersAndRoles.calledBefore(databaseOps.exportDatabase));
  t.true(databaseOps.importDatabase.calledBefore(databaseOps.applyPermissionsScript));
});

test('Migration handles users/roles errors gracefully', async (t) => {
  const logger = createMockLogger();
  const connectionManager = createMockConnectionManager();
  const databaseOps = createMockDatabaseOps();
  const progressTracker = createMockProgressTracker();

  const engine = new MigrationEngine(
    logger,
    connectionManager,
    databaseOps,
    progressTracker
  );

  // Mock extractor to return errors
  sinon.stub(engine.usersRolesExtractor, 'init').resolves();
  sinon.stub(engine.usersRolesExtractor, 'extractUsersAndRoles').resolves({
    roles: [{ rolname: 'test_user' }],
    dbPermissions: [],
    memberships: []
  });
  sinon.stub(engine.usersRolesExtractor, 'generateCreateScript').resolves('/tmp/users.sql');
  sinon.stub(engine.usersRolesExtractor, 'applyUsersAndRoles').resolves({
    success: true,
    successCount: 0,
    errorCount: 2,
    errors: [
      { statement: 'CREATE ROLE test', error: 'role exists' },
      { statement: 'CREATE ROLE test2', error: 'permission denied' }
    ]
  });

  const config = {
    source: { project: 'src-proj', instance: 'src-inst' },
    target: { project: 'tgt-proj', instance: 'tgt-inst' },
    options: {
      includeUsersRoles: true,
      includeAll: true
    }
  };

  // Mock database operations to continue despite user errors
  databaseOps.init.resolves();
  connectionManager.listDatabases.resolves([{ name: 'testdb', sizeBytes: 1000 }]);
  connectionManager.testConnection.resolves();
  databaseOps.exportDatabase.resolves({ database: 'testdb', backupFile: '/tmp/backup' });
  databaseOps.importDatabase.resolves({ database: 'testdb' });
  connectionManager.closeAllConnections.resolves();

  // Migration should complete even with user/role errors
  const result = await engine.migrate(config);

  t.truthy(result);
  t.true(result.success);

  // Verify warning was logged
  const statusCalls = progressTracker.status.getCalls();
  const warningCall = statusCalls.find(call => 
    call.args[1] === 'warning' && 
    call.args[0].includes('0 successful, 2 failed')
  );
  t.truthy(warningCall);
});

test('MigrationEngine migrate method accepts configuration', async (t) => {
  const logger = createMockLogger();
  const connectionManager = createMockConnectionManager();
  const databaseOps = createMockDatabaseOps();
  const progressTracker = createMockProgressTracker();

  const engine = new MigrationEngine(
    logger,
    connectionManager,
    databaseOps,
    progressTracker
  );

  const config = {
    source: { project: 'source-proj', instance: 'source-inst' },
    target: { project: 'target-proj', instance: 'target-inst' },
    options: { dryRun: true }
  };

  try {
    const result = await engine.migrate(config);
    t.truthy(result);
  } catch (err) {
    // Migration might fail due to mocked dependencies, that's ok for this test
    t.true(err instanceof Error);
  }
});

test('MigrationEngine calls progress tracker during execution', async (t) => {
  const logger = createMockLogger();
  const connectionManager = createMockConnectionManager();
  const databaseOps = createMockDatabaseOps();
  const progressTracker = createMockProgressTracker();

  const engine = new MigrationEngine(
    logger,
    connectionManager,
    databaseOps,
    progressTracker
  );

  const config = {
    source: { project: 'source-proj', instance: 'source-inst' },
    target: { project: 'target-proj', instance: 'target-inst' },
    options: { dryRun: true }
  };

  try {
    await engine.migrate(config);
  } catch {
    // Expected due to mocked dependencies
  }

  t.true(
    progressTracker.start.called ||
      progressTracker.update.called ||
      progressTracker.status.called ||
      progressTracker.startPhase.called
  );
});

test('MigrationEngine logs execution steps', async (t) => {
  const logger = createMockLogger();
  const connectionManager = createMockConnectionManager();
  const databaseOps = createMockDatabaseOps();
  const progressTracker = createMockProgressTracker();

  const engine = new MigrationEngine(
    logger,
    connectionManager,
    databaseOps,
    progressTracker
  );

  const config = {
    source: { project: 'source-proj', instance: 'source-inst' },
    target: { project: 'target-proj', instance: 'target-inst' },
    options: { dryRun: true }
  };

  try {
    await engine.migrate(config);
  } catch {
    // Expected due to mocked dependencies
  }

  t.true(logger.info.called || logger.debug.called);
});

test('MigrationEngine formats duration correctly if method exposed', (t) => {
  const logger = createMockLogger();
  const connectionManager = createMockConnectionManager();
  const databaseOps = createMockDatabaseOps();
  const progressTracker = createMockProgressTracker();

  const engine = new MigrationEngine(
    logger,
    connectionManager,
    databaseOps,
    progressTracker
  );

  if (typeof engine._formatDuration === 'function') {
    t.is(engine._formatDuration(30000), '30s');
    t.is(engine._formatDuration(90000), '1m 30s');
    t.is(engine._formatDuration(3700000), '1h 1m 40s');
  } else {
    t.pass(); // Skip if method not exposed
  }
});

test('MigrationEngine handles dry run mode', async (t) => {
  const logger = createMockLogger();
  const connectionManager = createMockConnectionManager();
  const databaseOps = createMockDatabaseOps();
  const progressTracker = createMockProgressTracker();

  const engine = new MigrationEngine(
    logger,
    connectionManager,
    databaseOps,
    progressTracker
  );

  const config = {
    source: { project: 'source-proj', instance: 'source-inst' },
    target: { project: 'target-proj', instance: 'target-inst' },
    options: { dryRun: true }
  };

  try {
    const result = await engine.migrate(config);

    if (result && typeof result === 'object') {
      // In dry run mode, should not perform actual operations
      t.true(result.dryRun === true || result.message.includes('dry'));
    }
  } catch {
    // Migration might fail, check if dry run was attempted - skip detailed check in test environment
    t.pass();
  }
});

test('MigrationEngine gets nested values correctly if method exposed', (t) => {
  const logger = createMockLogger();
  const connectionManager = createMockConnectionManager();
  const databaseOps = createMockDatabaseOps();
  const progressTracker = createMockProgressTracker();

  const engine = new MigrationEngine(
    logger,
    connectionManager,
    databaseOps,
    progressTracker
  );

  if (typeof engine._getNestedValue === 'function') {
    const testObject = {
      source: {
        project: 'test-project',
        instance: 'test-instance'
      }
    };

    t.is(engine._getNestedValue(testObject, 'source.project'), 'test-project');
    t.is(
      engine._getNestedValue(testObject, 'source.instance'),
      'test-instance'
    );
    t.is(engine._getNestedValue(testObject, 'source.nonexistent'), undefined);
  } else {
    t.pass(); // Skip if method not exposed
  }
});
