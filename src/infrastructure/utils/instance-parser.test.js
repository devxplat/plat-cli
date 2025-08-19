import test from 'ava';
import sinon from 'sinon';
import { promises as fs } from 'fs';
import InstanceParser from './instance-parser.js';

test.beforeEach((t) => {
  t.context.parser = new InstanceParser();
  t.context.sandbox = sinon.createSandbox();
});

test.afterEach((t) => {
  t.context.sandbox.restore();
});

// Test TXT parsing
test('parseTxt - parses simple instance list', (t) => {
  const content = `instance-1
instance-2
instance-3`;

  const result = t.context.parser.parseTxt(content);

  t.is(result.strategy, 'simple');
  t.is(result.sources.length, 3);
  t.is(result.sources[0].instance, 'instance-1');
  t.is(result.sources[2].instance, 'instance-3');
  t.is(result.targets, null);
});

test('parseTxt - handles project:instance format', (t) => {
  const content = `project1:instance-1
project2:instance-2`;

  const result = t.context.parser.parseTxt(content);

  t.is(result.sources.length, 2);
  t.is(result.sources[0].project, 'project1');
  t.is(result.sources[0].instance, 'instance-1');
  t.is(result.sources[1].project, 'project2');
  t.is(result.sources[1].instance, 'instance-2');
});

test('parseTxt - ignores comments and empty lines', (t) => {
  const content = `# This is a comment
instance-1

# Another comment
instance-2
  
instance-3`;

  const result = t.context.parser.parseTxt(content);

  t.is(result.sources.length, 3);
  t.is(result.sources[0].instance, 'instance-1');
  t.is(result.sources[1].instance, 'instance-2');
  t.is(result.sources[2].instance, 'instance-3');
});

// Test JSON parsing
test('parseJson - parses full migration mapping', (t) => {
  const content = JSON.stringify({
    strategy: 'consolidate',
    migrations: [
      {
        sources: ['inst1', 'inst2'],
        target: 'target-inst',
        databases: 'all'
      }
    ]
  });

  const result = t.context.parser.parseJson(content);

  t.is(result.strategy, 'consolidate');
  t.is(result.migrations.length, 1);
  t.is(result.migrations[0].sources.length, 2);
  t.is(result.migrations[0].target.instance, 'target-inst');
});

test('parseJson - parses simple instance list', (t) => {
  const content = JSON.stringify({
    instances: ['inst1', 'inst2', 'inst3'],
    strategy: 'simple'
  });

  const result = t.context.parser.parseJson(content);

  t.is(result.strategy, 'simple');
  t.is(result.sources.length, 3);
  t.is(result.sources[0].instance, 'inst1');
});

test('parseJson - parses array format', (t) => {
  const content = JSON.stringify(['inst1', 'inst2']);

  const result = t.context.parser.parseJson(content);

  t.is(result.strategy, 'simple');
  t.is(result.sources.length, 2);
  t.is(result.sources[0].instance, 'inst1');
  t.is(result.targets, null);
});

test('parseJson - throws on invalid format', (t) => {
  const content = JSON.stringify({ invalid: 'format' });

  t.throws(() => t.context.parser.parseJson(content), {
    message: 'Invalid JSON format'
  });
});

// Test CSV parsing
test('parseCsv - parses CSV with headers', (t) => {
  const content = `source_project,source_instance,target_project,target_instance,databases,version
proj1,inst1,proj2,target1,all,11
proj1,inst2,proj2,target2,db1;db2,13`;

  const result = t.context.parser.parseCsv(content);

  t.truthy(result);
  t.truthy(result.strategy);
});

test('parseCsv - handles quoted values', (t) => {
  const line = '"value with, comma","normal value","another, value"';
  const values = t.context.parser.parseCsvLine(line);

  t.is(values.length, 3);
  t.is(values[0], 'value with, comma');
  t.is(values[1], 'normal value');
  t.is(values[2], 'another, value');
});

test('parseCsv - throws on empty file', (t) => {
  t.throws(() => t.context.parser.parseCsv(''), {
    message: 'Empty CSV file'
  });
});

// Test file parsing
test.serial('parseFile - detects format by extension', async (t) => {
  const { parser, sandbox } = t.context;
  
  const txtContent = 'instance-1\ninstance-2';
  const readFileStub = sandbox.stub(fs, 'readFile').resolves(txtContent);

  const result = await parser.parseFile('/path/to/instances.txt');

  t.is(result.strategy, 'simple');
  t.is(result.sources.length, 2);
  t.true(readFileStub.calledWith('/path/to/instances.txt', 'utf8'));
  
  sandbox.restore();
});

test.serial('parseFile - throws on unsupported format', async (t) => {
  const { parser, sandbox } = t.context;
  
  sandbox.stub(fs, 'readFile').resolves('content');

  await t.throwsAsync(parser.parseFile('/path/to/file.xyz'), {
    message: 'Unsupported file format: .xyz'
  });
  
  sandbox.restore();
});

// Test configuration validation
test('validateConfiguration - validates simple strategy', (t) => {
  const config = {
    strategy: 'simple',
    sources: [{ instance: 'inst1' }]
  };

  const result = t.context.parser.validateConfiguration(config);

  t.true(result.valid);
  t.is(result.errors.length, 0);
});

test('validateConfiguration - detects missing sources', (t) => {
  const config = {
    strategy: 'simple',
    sources: []
  };

  const result = t.context.parser.validateConfiguration(config);

  t.false(result.valid);
  t.true(result.errors.includes('At least one source instance is required'));
});

test('validateConfiguration - detects duplicate sources', (t) => {
  const config = {
    strategy: 'simple',
    sources: [
      { project: 'proj1', instance: 'inst1' },
      { project: 'proj1', instance: 'inst1' }
    ]
  };

  const result = t.context.parser.validateConfiguration(config);

  t.true(result.valid); // Duplicates are warnings, not errors
  t.true(result.warnings.includes('Duplicate source instance: proj1:inst1'));
});

// Test migration config generation
test('generateMigrationConfig - applies CLI options', (t) => {
  const parsedData = {
    strategy: 'simple',
    sources: [{ instance: 'inst1' }]
  };

  const cliOptions = {
    targetProject: 'target-proj',
    targetInstance: 'target-inst',
    dryRun: true,
    verbose: true,
    retryAttempts: 5
  };

  const result = t.context.parser.generateMigrationConfig(parsedData, cliOptions);

  t.is(result.target.project, 'target-proj');
  t.is(result.target.instance, 'target-inst');
  t.true(result.options.dryRun);
  t.true(result.options.verbose);
  t.is(result.options.retryAttempts, 5);
});

test('generateMigrationConfig - applies default project', (t) => {
  const parsedData = {
    strategy: 'simple',
    sources: [{ instance: 'inst1' }, { project: 'proj2', instance: 'inst2' }]
  };

  const cliOptions = {
    defaultProject: 'default-proj'
  };

  const result = t.context.parser.generateMigrationConfig(parsedData, cliOptions);

  t.is(result.sources[0].project, 'default-proj');
  t.is(result.sources[1].project, 'proj2'); // Keeps explicit project
});

// Test version-based grouping
test('groupMigrationsByStrategy - groups by version', (t) => {
  const migrations = [
    { source: { instance: 'inst1' }, target: { instance: 'target11' }, version: '11' },
    { source: { instance: 'inst2' }, target: { instance: 'target11' }, version: '11' },
    { source: { instance: 'inst3' }, target: { instance: 'target13' }, version: '13' }
  ];

  const result = t.context.parser.groupMigrationsByStrategy(migrations);

  t.is(result.strategy, 'version-based');
  t.false(result.autoDetectVersion);
  t.truthy(result.versionMapping['11']);
  t.truthy(result.versionMapping['13']);
  t.is(result.versionMapping['11'].sources.length, 2);
});

test('groupMigrationsByStrategy - falls back to custom on version conflict', (t) => {
  const migrations = [
    { source: { instance: 'inst1' }, target: { instance: 'target1' }, version: '11' },
    { source: { instance: 'inst2' }, target: { instance: 'target2' }, version: '11' }
  ];

  const result = t.context.parser.groupMigrationsByStrategy(migrations);

  t.is(result.strategy, 'custom-mapping');
  t.is(result.migrations.length, 2);
});