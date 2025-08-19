import test from 'ava';
import PlatCli from './index.js';
import { createTestSuite } from './src/test-utils/index.js';

// Integration tests for the platform CLI system using mocked dependencies

test('ConnectionManager creates instance correctly', (t) => {
  const { connectionManager } = createTestSuite();

  t.truthy(connectionManager);
  t.is(typeof connectionManager.connect, 'function');
  t.is(typeof connectionManager.testConnection, 'function');
  t.is(typeof connectionManager.listDatabases, 'function');
});

test('ConnectionManager creates connection config', async (t) => {
  // Use the mock instead of creating actual instances that require config
  const { connectionManager } = createTestSuite();

  const config = await connectionManager.createConnectionConfig(
    'test-project',
    'test-instance',
    'test-db'
  );

  t.truthy(config);
  t.is(config.database, 'test-db');
  t.is(config.port, 5432);
  t.truthy(config.ssl);
});

test('DatabaseOperations creates instance correctly', (t) => {
  const { databaseOps } = createTestSuite();

  t.truthy(databaseOps);
  t.is(typeof databaseOps.exportDatabase, 'function');
  t.is(typeof databaseOps.importDatabase, 'function');
  t.is(typeof databaseOps.validateCompatibility, 'function');
});

test('DatabaseOperations formats bytes correctly', (t) => {
  const { databaseOps } = createTestSuite();

  t.is(databaseOps._formatBytes(0), '0 B');
  t.is(databaseOps._formatBytes(1024), '1 KB');
  t.is(databaseOps._formatBytes(1048576), '1 MB');
  t.is(databaseOps._formatBytes(1073741824), '1 GB');
});

test('DatabaseOperations parses PostgreSQL version correctly', (t) => {
  const { databaseOps } = createTestSuite();

  t.deepEqual(databaseOps._parseVersion('PostgreSQL 13.2'), {
    major: 13,
    minor: 2
  });
  t.deepEqual(databaseOps._parseVersion('PostgreSQL 15'), {
    major: 15,
    minor: 0
  });
  t.deepEqual(databaseOps._parseVersion('invalid'), { major: 0, minor: 0 });
});

test('MigrationEngine creates instance correctly', (t) => {
  const { migrationEngine } = createTestSuite();

  t.truthy(migrationEngine);
  t.is(typeof migrationEngine.migrate, 'function');
  t.is(typeof migrationEngine.getState, 'function');
});

test('MigrationEngine formats duration correctly', (t) => {
  const { migrationEngine } = createTestSuite();

  t.is(migrationEngine._formatDuration(30000), '30s');
  t.is(migrationEngine._formatDuration(90000), '1m 30s');
  t.is(migrationEngine._formatDuration(3700000), '1h 1m 40s');
});

test('MigrationEngine gets nested values correctly', (t) => {
  const { migrationEngine } = createTestSuite();

  const testObject = {
    source: {
      project: 'test-project',
      instance: 'test-instance'
    }
  };

  t.is(
    migrationEngine._getNestedValue(testObject, 'source.project'),
    'test-project'
  );
  t.is(
    migrationEngine._getNestedValue(testObject, 'source.instance'),
    'test-instance'
  );
  t.is(
    migrationEngine._getNestedValue(testObject, 'nonexistent.path'),
    undefined
  );
});

test('ProgressTracker creates instance correctly', (t) => {
  const { progressTracker } = createTestSuite();

  t.truthy(progressTracker);
  t.is(typeof progressTracker.init, 'function');
  t.is(typeof progressTracker.startPhase, 'function');
  t.is(typeof progressTracker.update, 'function');
  t.is(typeof progressTracker.complete, 'function');
});

test('ProgressTracker formats time correctly with logger', (t) => {
  const { progressTracker } = createTestSuite();

  t.is(progressTracker._formatTime(30), '30s');
  t.is(progressTracker._formatTime(90), '1m 30s');
  t.is(progressTracker._formatTime(3661), '1h 1m'); // Fixed: 3661 seconds = 1h 1m 1s, rounds to 1h 1m
});

test('ProgressTracker formats rate correctly', (t) => {
  const { progressTracker } = createTestSuite();

  t.is(progressTracker._formatRate(0.05), '< 0.1/s');
  t.is(progressTracker._formatRate(0.5), '0.5/s');
  t.is(progressTracker._formatRate(5), '5/s');
  t.is(progressTracker._formatRate(1500), '1.5k/s');
});

test('PlatCli exports main class', (t) => {
  t.is(typeof PlatCli, 'function');

  const cli = new PlatCli();
  t.truthy(cli);
  t.is(typeof cli.execute, 'function');
  t.is(typeof cli.migrate, 'function');
});

test('PlatCli exports CLI', (t) => {
  // PlatCli is the main class, check if it has expected interface
  t.is(typeof PlatCli, 'function');
  const instance = new PlatCli();
  t.truthy(instance);
  t.is(typeof instance.execute, 'function');
  t.is(typeof instance.migrate, 'function');
});
