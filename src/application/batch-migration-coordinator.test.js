import test from 'ava';
import sinon from 'sinon';
import BatchMigrationCoordinator from './batch-migration-coordinator.js';
import MigrationMapping from '../domain/models/migration-mapping.js';

test.beforeEach((t) => {
  t.context.sandbox = sinon.createSandbox();
  
  // Mock dependencies
  t.context.mockCoordinator = {
    execute: t.context.sandbox.stub(),
    getTool: t.context.sandbox.stub(),
    getAvailableTools: t.context.sandbox.stub()
  };

  t.context.mockLogger = {
    info: t.context.sandbox.stub(),
    warn: t.context.sandbox.stub(),
    error: t.context.sandbox.stub()
  };

  t.context.mockProgressTracker = {
    update: t.context.sandbox.stub()
  };

  t.context.mockValidator = {
    validate: t.context.sandbox.stub()
  };

  t.context.batchCoordinator = new BatchMigrationCoordinator({
    coordinator: t.context.mockCoordinator,
    logger: t.context.mockLogger,
    progressTracker: t.context.mockProgressTracker,
    validator: t.context.mockValidator,
    maxParallel: 2,
    stopOnError: false,
    retryFailed: false
  });
});

test.afterEach((t) => {
  t.context.sandbox.restore();
});

test('constructor - initializes with default values', (t) => {
  const coordinator = new BatchMigrationCoordinator({});
  
  t.is(coordinator.maxParallel, 3);
  t.true(coordinator.stopOnError);
  t.true(coordinator.retryFailed);
  t.deepEqual(coordinator.completedMigrations, []);
  t.deepEqual(coordinator.failedMigrations, []);
});

test('executeBatch - validates mapping before execution', async (t) => {
  const { batchCoordinator } = t.context;
  
  const mapping = new MigrationMapping({
    strategy: 'simple',
    sources: [], // Invalid - no sources
    targets: []
  });

  await t.throwsAsync(
    batchCoordinator.executeBatch(mapping, () => {}),
    { message: /Invalid mapping/ }
  );
});

test('executeBatch - executes simple consolidation', async (t) => {
  const { batchCoordinator, mockCoordinator } = t.context;
  
  const mapping = new MigrationMapping({
    strategy: 'consolidate',
    sources: [
      { project: 'p1', instance: 'inst1' },
      { project: 'p1', instance: 'inst2' }
    ],
    targets: [{ project: 'p2', instance: 'target' }]
  });

  // Mock tool validation
  const mockTool = {
    validate: t.context.sandbox.stub().resolves({ isValid: true })
  };
  mockCoordinator.getTool.returns(mockTool);

  // Mock successful executions
  mockCoordinator.execute.resolves({
    migratedDatabases: ['db1', 'db2'],
    success: true
  });

  const progressCallback = t.context.sandbox.stub();
  const result = await batchCoordinator.executeBatch(mapping, progressCallback);

  t.truthy(result);
  t.is(result.summary.successful, 2);
  t.is(result.summary.failed, 0);
  t.is(result.successful.length, 2);
  t.true(progressCallback.called);
});

test('executeBatch - handles mixed success and failure', async (t) => {
  const { batchCoordinator, mockCoordinator } = t.context;
  
  const mapping = new MigrationMapping({
    strategy: 'simple',
    sources: [
      { instance: 'inst1' },
      { instance: 'inst2' }
    ],
    targets: [{ project: 'p1', instance: 'target' }]
  });

  const mockTool = {
    validate: t.context.sandbox.stub().resolves({ isValid: true })
  };
  mockCoordinator.getTool.returns(mockTool);

  // First succeeds, second fails
  mockCoordinator.execute
    .onFirstCall().resolves({ success: true })
    .onSecondCall().rejects(new Error('Connection failed'));

  const result = await batchCoordinator.executeBatch(mapping, () => {});

  t.is(result.summary.successful, 1);
  t.is(result.summary.failed, 1);
  t.is(result.failed.length, 1);
  t.is(result.failed[0].error, 'Connection failed');
});

test('executeBatch - stops on error when configured', async (t) => {
  const { mockCoordinator, mockLogger, mockProgressTracker, mockValidator } = t.context;
  
  const coordinator = new BatchMigrationCoordinator({
    coordinator: mockCoordinator,
    logger: mockLogger,
    progressTracker: mockProgressTracker,
    validator: mockValidator,
    maxParallel: 1,
    stopOnError: true,
    retryFailed: false
  });

  const mapping = new MigrationMapping({
    strategy: 'simple',
    sources: [
      { instance: 'inst1' },
      { instance: 'inst2' },
      { instance: 'inst3' }
    ],
    targets: [{ project: 'p1', instance: 'target' }]
  });

  const mockTool = {
    validate: t.context.sandbox.stub().resolves({ isValid: true })
  };
  mockCoordinator.getTool.returns(mockTool);

  // First fails
  mockCoordinator.execute.rejects(new Error('First failed'));

  await t.throwsAsync(
    coordinator.executeBatch(mapping, () => {}),
    { message: /Stopping batch execution due to failure/ }
  );
});

test('executeBatch - respects maxParallel limit', async (t) => {
  const { batchCoordinator, mockCoordinator } = t.context;
  
  const mapping = new MigrationMapping({
    strategy: 'simple',
    sources: [
      { instance: 'inst1' },
      { instance: 'inst2' },
      { instance: 'inst3' },
      { instance: 'inst4' }
    ],
    targets: [{ project: 'p1', instance: 'target' }]
  });

  const mockTool = {
    validate: t.context.sandbox.stub().resolves({ isValid: true })
  };
  mockCoordinator.getTool.returns(mockTool);

  let concurrentExecutions = 0;
  let maxConcurrent = 0;

  mockCoordinator.execute.callsFake(async () => {
    concurrentExecutions++;
    maxConcurrent = Math.max(maxConcurrent, concurrentExecutions);
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 10));
    
    concurrentExecutions--;
    return { success: true };
  });

  await batchCoordinator.executeBatch(mapping, () => {});

  t.true(maxConcurrent <= 2); // maxParallel is set to 2
});

test('_createOperations - creates correct operation configs', (t) => {
  const { batchCoordinator } = t.context;
  
  const tasks = [
    {
      source: { project: 'p1', instance: 'inst1' },
      target: { project: 'p2', instance: 'target' },
      databases: 'all',
      conflictResolution: 'prefix'
    }
  ];

  const mapping = new MigrationMapping({
    strategy: 'consolidate',
    options: { dryRun: true, verbose: true }
  });

  const operations = batchCoordinator._createOperations(tasks, mapping);

  t.is(operations.length, 1);
  t.is(operations[0].config.source.instance, 'inst1');
  t.is(operations[0].config.target.instance, 'target');
  t.true(operations[0].config.options.includeAll);
  t.is(operations[0].config.options.conflictResolution, 'prefix');
  t.true(operations[0].config.options.dryRun);
});

test('_validateAllOperations - validates all operations', async (t) => {
  const { batchCoordinator, mockCoordinator } = t.context;
  
  const mockTool = {
    validate: t.context.sandbox.stub()
      .onFirstCall().resolves({ isValid: true })
      .onSecondCall().resolves({ isValid: false })
  };
  
  mockCoordinator.getTool.returns(mockTool);

  const operations = [
    { id: 'op1', config: {} },
    { id: 'op2', config: {} }
  ];

  await t.throwsAsync(
    batchCoordinator._validateAllOperations(operations),
    { message: /Validation failed for 1 migrations/ }
  );
});

test('_retryFailedOperations - retries failed operations', async (t) => {
  const { batchCoordinator, mockCoordinator } = t.context;
  
  const operations = [
    { id: 'op1', config: {} },
    { id: 'op2', config: {} }
  ];

  // First fails, second succeeds
  mockCoordinator.execute
    .onFirstCall().rejects(new Error('Still fails'))
    .onSecondCall().resolves({ success: true });

  const progressCallback = t.context.sandbox.stub();
  const result = await batchCoordinator._retryFailedOperations(operations, progressCallback);

  t.is(result.successful.length, 1);
  t.is(result.failed.length, 1);
  t.true(progressCallback.called);
});

test('_consolidateDatabases - handles merge conflict resolution', async (t) => {
  const { batchCoordinator, mockLogger } = t.context;
  
  const results = {
    successful: [
      {
        operation: {
          config: {
            source: { project: 'p1', instance: 'inst1' },
            target: { project: 'p2', instance: 'target' }
          }
        },
        result: { migratedDatabases: ['users', 'products'] }
      },
      {
        operation: {
          config: {
            source: { project: 'p1', instance: 'inst2' },
            target: { project: 'p2', instance: 'target' }
          }
        },
        result: { migratedDatabases: ['users', 'orders'] }
      }
    ]
  };

  const mapping = new MigrationMapping({
    conflictResolution: 'merge'
  });

  await batchCoordinator._consolidateDatabases(results, mapping);

  t.true(mockLogger.warn.calledWith(
    sinon.match(/Database "users" was migrated from multiple sources/)
  ));
});

test('_generateReport - creates comprehensive report', (t) => {
  const { batchCoordinator } = t.context;
  
  const results = {
    successful: [
      {
        operation: {
          id: 'op1',
          config: {
            source: { project: 'p1', instance: 'inst1' },
            target: { project: 'p2', instance: 'target' }
          }
        },
        result: { migratedDatabases: ['db1'] },
        duration: 5000
      }
    ],
    failed: [
      {
        operation: {
          id: 'op2',
          config: {
            source: { project: 'p1', instance: 'inst2' },
            target: { project: 'p2', instance: 'target' }
          }
        },
        error: 'Connection failed',
        duration: 1000
      }
    ],
    skipped: []
  };

  const mapping = new MigrationMapping({
    strategy: 'consolidate',
    metadata: { mappingType: 'N:1' }
  });

  const report = batchCoordinator._generateReport(results, mapping, Date.now() - 10000);

  t.is(report.summary.successful, 1);
  t.is(report.summary.failed, 1);
  t.is(report.summary.skipped, 0);
  t.is(report.successful.length, 1);
  t.is(report.failed.length, 1);
  t.truthy(report.performance);
  t.truthy(report.metadata);
});

test('_formatDuration - formats milliseconds correctly', (t) => {
  const { batchCoordinator } = t.context;
  
  t.is(batchCoordinator._formatDuration(500), '500ms');
  t.is(batchCoordinator._formatDuration(1500), '1.5s');
  t.is(batchCoordinator._formatDuration(65000), '1m 5s');
  t.is(batchCoordinator._formatDuration(3665000), '1h 1m');
});

test('getStatus - returns current batch status', (t) => {
  const { batchCoordinator } = t.context;
  
  batchCoordinator.activeMigrations.set('op1', {
    startTime: Date.now() - 5000,
    operation: {}
  });
  batchCoordinator.completedMigrations = [{}, {}];
  batchCoordinator.failedMigrations = [{}];
  batchCoordinator.pendingMigrations = [{}, {}, {}];

  const status = batchCoordinator.getStatus();

  t.is(status.active, 1);
  t.is(status.completed, 2);
  t.is(status.failed, 1);
  t.is(status.pending, 3);
  t.is(status.activeMigrations.length, 1);
});

test('cancelBatch - clears active migrations', async (t) => {
  const { batchCoordinator } = t.context;
  
  batchCoordinator.activeMigrations.set('op1', {});
  batchCoordinator.completedMigrations = [{}];
  batchCoordinator.failedMigrations = [{}];

  const result = await batchCoordinator.cancelBatch();

  t.true(result.cancelled);
  t.is(result.completed, 1);
  t.is(result.failed, 1);
  t.is(batchCoordinator.activeMigrations.size, 0);
});