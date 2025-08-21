import test from 'ava';
import sinon from 'sinon';
import CloudSQLManager from './gcp-cloudsql-manager.js';

test('CloudSQLManager initializes with logger and project', (t) => {
  const mockLogger = {
    info: sinon.stub(),
    error: sinon.stub(),
    warn: sinon.stub()
  };

  const manager = new CloudSQLManager(mockLogger, 'test-project');

  t.is(manager.logger, mockLogger);
  t.is(manager.project, 'test-project');
  t.is(manager.sqladmin, null);
  t.is(manager.auth, null);
});

test('CloudSQLManager getInstance returns instance details', async (t) => {
  const mockLogger = {
    info: sinon.stub(),
    error: sinon.stub(),
    debug: sinon.stub()
  };

  const manager = new CloudSQLManager(mockLogger, 'test-project');

  // Mock the sqladmin API
  manager.sqladmin = {
    instances: {
      get: sinon.stub().resolves({
        data: {
          name: 'test-instance',
          databaseVersion: 'POSTGRES_13',
          state: 'RUNNABLE'
        }
      })
    }
  };

  const instance = await manager.getInstance('test-instance');

  t.is(instance.name, 'test-instance');
  t.is(instance.databaseVersion, 'POSTGRES_13');
  t.true(mockLogger.debug.called);
});

test('CloudSQLManager getInstance handles errors', async (t) => {
  const mockLogger = {
    info: sinon.stub(),
    error: sinon.stub(),
    debug: sinon.stub()
  };

  const manager = new CloudSQLManager(mockLogger, 'test-project');

  // Mock the sqladmin API to throw error
  manager.sqladmin = {
    instances: {
      get: sinon.stub().rejects(new Error('API Error'))
    }
  };

  await t.throwsAsync(
    async () => {
      await manager.getInstance('test-instance');
    },
    { message: 'API Error' }
  );

  t.true(mockLogger.error.called);
});

test('CloudSQLManager listInstances returns instance list', async (t) => {
  const mockLogger = {
    info: sinon.stub(),
    error: sinon.stub(),
    debug: sinon.stub()
  };

  const manager = new CloudSQLManager(mockLogger, 'test-project');

  // Mock the sqladmin API
  manager.sqladmin = {
    instances: {
      list: sinon.stub().resolves({
        data: {
          items: [
            { name: 'instance-1', state: 'RUNNABLE' },
            { name: 'instance-2', state: 'RUNNABLE' }
          ]
        }
      })
    }
  };

  const instances = await manager.listInstances();

  t.is(instances.length, 2);
  t.is(instances[0].name, 'instance-1');
});

test('CloudSQLManager listInstances handles empty list', async (t) => {
  const mockLogger = {
    info: sinon.stub(),
    error: sinon.stub(),
    warn: sinon.stub()
  };

  const manager = new CloudSQLManager(mockLogger, 'test-project');

  // Mock the sqladmin API with no items
  manager.sqladmin = {
    instances: {
      list: sinon.stub().resolves({
        data: {}
      })
    }
  };

  const instances = await manager.listInstances();

  t.deepEqual(instances, []);
  t.true(mockLogger.warn.called);
});

test('CloudSQLManager listDatabases returns database list', async (t) => {
  const mockLogger = {
    info: sinon.stub(),
    error: sinon.stub(),
    debug: sinon.stub()
  };

  const manager = new CloudSQLManager(mockLogger, 'test-project');

  // Mock the sqladmin API
  manager.sqladmin = {
    databases: {
      list: sinon.stub().resolves({
        data: {
          items: [
            { name: 'postgres', charset: 'UTF8' },
            { name: 'app_db', charset: 'UTF8' }
          ]
        }
      })
    }
  };

  const databases = await manager.listDatabases('test-instance');

  t.is(databases.length, 2);
  t.is(databases[0].name, 'postgres');
  t.true(mockLogger.debug.called);
});

test('CloudSQLManager validates instance state', async (t) => {
  const mockLogger = {
    info: sinon.stub(),
    error: sinon.stub(),
    warn: sinon.stub(),
    debug: sinon.stub()
  };

  const manager = new CloudSQLManager(mockLogger, 'test-project');

  // Test with RUNNABLE state
  manager.sqladmin = {
    instances: {
      get: sinon.stub().resolves({
        data: {
          name: 'test-instance',
          state: 'RUNNABLE'
        }
      })
    }
  };

  const validInstance = await manager.getInstance('test-instance');
  t.is(validInstance.state, 'RUNNABLE');

  // Test with SUSPENDED state
  manager.sqladmin.instances.get.resolves({
    data: {
      name: 'test-instance',
      state: 'SUSPENDED'
    }
  });

  const suspendedInstance = await manager.getInstance('test-instance');
  t.is(suspendedInstance.state, 'SUSPENDED');
  t.true(mockLogger.warn.called);
});

test('CloudSQLManager handles authentication not initialized', async (t) => {
  const mockLogger = {
    info: sinon.stub(),
    error: sinon.stub()
  };

  const manager = new CloudSQLManager(mockLogger, 'test-project');

  // Try to use without init
  await t.throwsAsync(async () => {
    await manager.getInstance('test-instance');
  });
});
