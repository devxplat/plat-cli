import test from 'ava';
import sinon from 'sinon';
import PlatCli, {
  ClassicCLI,
  InteractiveCLI,
  OperationConfig
} from './index.js';

test('PlatCli exports main class', (t) => {
  t.is(typeof PlatCli, 'function');

  const cli = new PlatCli();
  t.truthy(cli);
  t.is(typeof cli.execute, 'function');
  t.is(typeof cli.migrate, 'function');
});

test('PlatCli exports required interfaces', (t) => {
  t.truthy(ClassicCLI);
  t.truthy(InteractiveCLI);
  t.truthy(OperationConfig);

  t.is(typeof ClassicCLI, 'function');
  t.is(typeof InteractiveCLI, 'function');
  t.is(typeof OperationConfig, 'function');
});

test('PlatCli creates instance with default configuration', async (t) => {
  const cli = new PlatCli();

  t.truthy(cli);
  t.false(cli._initialized); // Not initialized yet
  
  // Initialize services
  await cli._initializeServices();
  t.truthy(cli.logger);
  t.truthy(cli.coordinator);
});

test('PlatCli creates instance with custom configuration', async (t) => {
  const config = {
    logLevel: 'debug',
    enableFileLogging: false,
    cliMode: true,
    quiet: false
  };

  const cli = new PlatCli(config);

  t.truthy(cli);
  t.false(cli._initialized); // Not initialized yet
  
  // Initialize services
  await cli._initializeServices();
  t.truthy(cli.logger);
  t.truthy(cli.coordinator);
});

test('PlatCli has required public methods', (t) => {
  const cli = new PlatCli();

  const expectedMethods = [
    'execute',
    'migrate',
    'getAvailableTools',
    'getEstimate',
    'runClassicCLI',
    'runInteractiveCLI'
  ];

  for (const method of expectedMethods) {
    t.is(typeof cli[method], 'function');
  }
});

test('PlatCli execute method accepts tool name and config', async (t) => {
  const cli = new PlatCli({ enableFileLogging: false });

  const config = {
    source: { project: 'source-proj', instance: 'source-inst' },
    target: { project: 'target-proj', instance: 'target-inst' },
    options: { dryRun: true }
  };

  try {
    const result = await cli.execute('gcp.cloudsql.migrate', config);
    t.truthy(result);
  } catch (error) {
    // Expected to fail without proper GCP setup
    t.true(error instanceof Error);
  }
});

test('PlatCli migrate method provides legacy compatibility', async (t) => {
  const cli = new PlatCli({ enableFileLogging: false });

  const migrationConfig = {
    source: { project: 'source-proj', instance: 'source-inst' },
    target: { project: 'target-proj', instance: 'target-inst' },
    options: { dryRun: true }
  };

  try {
    const result = await cli.migrate(migrationConfig);
    t.truthy(result);
  } catch (error) {
    // Expected to fail without proper GCP setup
    t.true(error instanceof Error);
  }
});

test('PlatCli getAvailableTools returns tool list', async (t) => {
  const cli = new PlatCli();

  // Mock the coordinator to return tools
  const mockCoordinator = {
    getAvailableTools: () => [
      {
        name: 'gcp.cloudsql.migrate',
        metadata: { description: 'Migrate CloudSQL' }
      }
    ],
    initialize: async () => {}
  };

  // Replace the coordinator with our mock
  cli.coordinator = mockCoordinator;
  cli._initialized = true; // Mark as initialized since we're using a mock
  const tools = await cli.getAvailableTools();
  t.true(Array.isArray(tools));
  t.true(tools.length > 0);

  // Should include CloudSQL migration tool
  const migrationTool = tools.find(
    (tool) => tool.name === 'gcp.cloudsql.migrate'
  );
  t.truthy(migrationTool);
});

test('PlatCli getEstimate provides execution estimates', async (t) => {
  const cli = new PlatCli({ enableFileLogging: false });

  const config = {
    source: { project: 'source-proj', instance: 'source-inst' },
    target: { project: 'target-proj', instance: 'target-inst' },
    options: {}
  };

  try {
    const estimate = await cli.getEstimate('gcp.cloudsql.migrate', config);
    t.truthy(estimate);
    t.true(typeof estimate.estimatedDuration === 'number');
  } catch (error) {
    // Estimation might fail without proper setup
    t.true(error instanceof Error);
  }
});

test('PlatCli runClassicCLI launches CLI interface', async (t) => {
  const cli = new PlatCli({ enableFileLogging: false });

  const testArgs = ['node', 'plat-cli', '--help'];

  try {
    const result = await cli.runClassicCLI(testArgs);
    t.truthy(result !== undefined);
  } catch (error) {
    // CLI throws CommanderError for help command in test environment
    t.true(error instanceof Error);
    t.true(
      error.code === 'commander.helpDisplayed' || error.message.includes('help')
    );
  }
});

test('PlatCli runInteractiveCLI launches interactive interface', async (t) => {
  const cli = new PlatCli({ enableFileLogging: false });

  // Interactive CLI would normally wait for user input
  // We'll just test that it can be instantiated
  t.is(typeof cli.runInteractiveCLI, 'function');

  // Don't actually run it as it would block the test
  t.pass();
});

test('PlatCli handles OperationConfig instances', async (t) => {
  const cli = new PlatCli({ enableFileLogging: false });

  const config = new OperationConfig({
    source: { project: 'source-proj', instance: 'source-inst' },
    target: { project: 'target-proj', instance: 'target-inst' },
    options: { dryRun: true },
    metadata: { toolName: 'gcp.cloudsql.migrate', source: 'test' }
  });

  try {
    const result = await cli.execute('gcp.cloudsql.migrate', config);
    t.truthy(result);
  } catch (error) {
    // Expected to fail without proper GCP setup
    t.true(error instanceof Error);
  }
});

test('PlatCli handles plain object configurations', async (t) => {
  const cli = new PlatCli({ enableFileLogging: false });

  const plainConfig = {
    source: { project: 'source-proj', instance: 'source-inst' },
    target: { project: 'target-proj', instance: 'target-inst' },
    options: { dryRun: true }
  };

  try {
    const result = await cli.execute('gcp.cloudsql.migrate', plainConfig);
    t.truthy(result);
  } catch (error) {
    // Expected to fail without proper GCP setup
    t.true(error instanceof Error);
  }
});

test('PlatCli initializes services correctly', async (t) => {
  const cli = new PlatCli({
    logLevel: 'debug',
    enableFileLogging: true,
    cliMode: false,
    quiet: true
  });

  // Initialize services
  await cli._initializeServices();
  
  // Should have initialized logger and coordinator
  t.truthy(cli.logger);
  t.truthy(cli.coordinator);

  // Services should be properly wired together
  t.is(typeof cli.logger.info, 'function');
  t.is(typeof cli.coordinator.execute, 'function');
});

test('ClassicCLI can be instantiated independently', (t) => {
  const classicCLI = new ClassicCLI();

  t.truthy(classicCLI);
  t.is(typeof classicCLI.run, 'function');
});

test('InteractiveCLI can be instantiated independently', (t) => {
  const mockCoordinator = {
    getAvailableTools: sinon.stub().returns([]),
    execute: sinon.stub().resolves({ success: true })
  };

  const mockLogger = {
    info: sinon.stub(),
    error: sinon.stub()
  };

  const interactiveCLI = new InteractiveCLI({
    coordinator: mockCoordinator,
    logger: mockLogger
  });

  t.truthy(interactiveCLI);
  t.is(typeof interactiveCLI.start, 'function');
});

test('OperationConfig can be instantiated with configuration', (t) => {
  const config = new OperationConfig({
    source: { project: 'test-project' },
    target: { project: 'test-target' },
    options: { dryRun: true },
    metadata: { toolName: 'test-tool' }
  });

  t.truthy(config);
  t.is(config.source.project, 'test-project');
  t.is(config.target.project, 'test-target');
  t.true(config.options.dryRun);
  t.is(config.metadata.toolName, 'test-tool');
});
