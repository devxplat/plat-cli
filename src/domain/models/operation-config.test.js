import test from 'ava';
import OperationConfig from './operation-config.js';

test('OperationConfig creates instance with basic configuration', (t) => {
  const config = new OperationConfig({
    source: { project: 'source-proj', instance: 'source-inst' },
    target: { project: 'target-proj', instance: 'target-inst' },
    options: {}
  });

  t.truthy(config);
  t.is(config.source.project, 'source-proj');
  t.is(config.target.project, 'target-proj');
});

test('OperationConfig creates instance with empty configuration', (t) => {
  const config = new OperationConfig({});

  t.truthy(config);
  // Should handle empty config gracefully
});

test('OperationConfig preserves source configuration', (t) => {
  const sourceConfig = {
    project: 'test-project',
    instance: 'test-instance',
    databases: ['db1', 'db2']
  };

  const config = new OperationConfig({
    source: sourceConfig,
    target: { project: 'target' },
    options: {}
  });

  t.deepEqual(config.source, sourceConfig);
  t.deepEqual(config.source.databases, ['db1', 'db2']);
});

test('OperationConfig preserves target configuration', (t) => {
  const targetConfig = {
    project: 'target-project',
    instance: 'target-instance'
  };

  const config = new OperationConfig({
    source: { project: 'source' },
    target: targetConfig,
    options: {}
  });

  t.deepEqual(config.target, targetConfig);
});

test('OperationConfig preserves options configuration', (t) => {
  const options = {
    dryRun: true,
    retryAttempts: 5,
    schemaOnly: false,
    verbose: true
  };

  const config = new OperationConfig({
    source: { project: 'source' },
    target: { project: 'target' },
    options
  });

  // Check that our provided options are preserved
  t.true(config.options.dryRun);
  t.is(config.options.retryAttempts, 5);
  t.false(config.options.schemaOnly);
  t.true(config.options.verbose);
  
  // OperationConfig adds defaults, so check the structure includes our values
  t.true(typeof config.options === 'object');
});

test('OperationConfig handles metadata', (t) => {
  const metadata = {
    toolName: 'gcp.cloudsql.migrate',
    source: 'interactive-cli'
  };

  const config = new OperationConfig({
    source: { project: 'source' },
    target: { project: 'target' },
    options: {},
    metadata
  });

  // Check that our provided metadata is preserved
  t.is(config.metadata.toolName, 'gcp.cloudsql.migrate');
  t.is(config.metadata.source, 'interactive-cli');
  
  // OperationConfig adds defaults like version, executionId, timestamp
  t.truthy(config.metadata.version);
  t.truthy(config.metadata.executionId);
  t.truthy(config.metadata.timestamp);
});

test('OperationConfig validates structure if validation method exists', (t) => {
  const config = new OperationConfig({
    source: { project: 'source-proj', instance: 'source-inst' },
    target: { project: 'target-proj', instance: 'target-inst' },
    options: { dryRun: false }
  });

  if (typeof config.validate === 'function') {
    const validation = config.validate();
    t.true(typeof validation === 'object');
    // The validation object should have an isValid property or errors array
    t.true('isValid' in validation || 'errors' in validation);
  } else {
    t.pass(); // Skip if no validation method
  }
});

test('OperationConfig serializes to JSON if method exists', (t) => {
  const config = new OperationConfig({
    source: { project: 'source' },
    target: { project: 'target' },
    options: { dryRun: true }
  });

  if (typeof config.toJSON === 'function') {
    const json = config.toJSON();
    t.true(typeof json === 'object');
    t.is(json.source.project, 'source');
  } else {
    // Test native JSON serialization
    const json = JSON.parse(JSON.stringify(config));
    t.true(typeof json === 'object');
    t.is(json.source.project, 'source');
  }
});

test('OperationConfig handles complex database selection', (t) => {
  const config = new OperationConfig({
    source: { 
      project: 'source-proj',
      instance: 'source-inst',
      databases: ['users', 'orders', 'inventory']
    },
    target: { project: 'target-proj', instance: 'target-inst' },
    options: { 
      includeAll: false,
      schemaOnly: true,
      dataOnly: false
    }
  });

  t.deepEqual(config.source.databases, ['users', 'orders', 'inventory']);
  t.false(config.options.includeAll);
  t.true(config.options.schemaOnly);
});

test('OperationConfig handles null and undefined values', (t) => {
  const config = new OperationConfig({
    source: null,
    target: undefined,
    options: {}
  });

  t.truthy(config);
  // Should handle null/undefined gracefully without throwing
});