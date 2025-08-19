import test from 'ava';
import MigrationMapping from './migration-mapping.js';

test('constructor - initializes with default values', (t) => {
  const mapping = new MigrationMapping();

  t.is(mapping.strategy, 'simple');
  t.deepEqual(mapping.sources, []);
  t.deepEqual(mapping.targets, []);
  t.is(mapping.conflictResolution, 'fail');
  t.true(mapping.autoDetectVersion);
  t.truthy(mapping.metadata.createdAt);
});

test('constructor - accepts configuration', (t) => {
  const config = {
    strategy: 'consolidate',
    sources: [{ instance: 'inst1' }, { instance: 'inst2' }],
    targets: [{ instance: 'target1' }],
    conflictResolution: 'prefix'
  };

  const mapping = new MigrationMapping(config);

  t.is(mapping.strategy, 'consolidate');
  t.is(mapping.sources.length, 2);
  t.is(mapping.targets.length, 1);
  t.is(mapping.conflictResolution, 'prefix');
});

// Test mapping type analysis
test('_analyzeMappingType - detects N:1', (t) => {
  const mapping = new MigrationMapping({
    sources: [{ instance: 'inst1' }, { instance: 'inst2' }],
    targets: [{ instance: 'target1' }]
  });

  t.is(mapping.metadata.mappingType, 'N:1');
  t.is(mapping.metadata.totalSources, 2);
  t.is(mapping.metadata.totalTargets, 1);
});

test('_analyzeMappingType - detects N:N', (t) => {
  const mapping = new MigrationMapping({
    sources: [{ instance: 'inst1' }, { instance: 'inst2' }],
    targets: [{ instance: 'target1' }, { instance: 'target2' }]
  });

  t.is(mapping.metadata.mappingType, 'N:N');
  t.is(mapping.metadata.totalSources, 2);
  t.is(mapping.metadata.totalTargets, 2);
});

test('_analyzeMappingType - detects 1:N', (t) => {
  const mapping = new MigrationMapping({
    sources: [{ instance: 'inst1' }],
    targets: [{ instance: 'target1' }, { instance: 'target2' }]
  });

  t.is(mapping.metadata.mappingType, '1:N');
  t.is(mapping.metadata.totalSources, 1);
  t.is(mapping.metadata.totalTargets, 2);
});

// Test execution plan generation
test('generateExecutionPlan - simple strategy N:1', (t) => {
  const mapping = new MigrationMapping({
    strategy: 'simple',
    sources: [{ instance: 'inst1' }, { instance: 'inst2' }],
    targets: [{ instance: 'target1' }]
  });

  const tasks = mapping.generateExecutionPlan();

  t.is(tasks.length, 2);
  t.is(tasks[0].source.instance, 'inst1');
  t.is(tasks[0].target.instance, 'target1');
  t.is(tasks[1].source.instance, 'inst2');
  t.is(tasks[1].target.instance, 'target1');
});

test('generateExecutionPlan - consolidate strategy', (t) => {
  const mapping = new MigrationMapping({
    strategy: 'consolidate',
    sources: [
      { instance: 'inst1', databases: ['db1'] },
      { instance: 'inst2', databases: ['db2'] }
    ],
    targets: [{ instance: 'target1' }],
    conflictResolution: 'prefix'
  });

  const tasks = mapping.generateExecutionPlan();

  t.is(tasks.length, 2);
  t.is(tasks[0].conflictResolution, 'prefix');
  t.is(tasks[0].prefixWith, 'inst1');
  t.is(tasks[1].prefixWith, 'inst2');
});

test('generateExecutionPlan - version-based strategy', (t) => {
  const mapping = new MigrationMapping({
    strategy: 'version-based',
    versionMapping: {
      '11': {
        sources: [{ instance: 'inst11-1' }, { instance: 'inst11-2' }],
        target: { instance: 'target11' }
      },
      '13': {
        sources: [{ instance: 'inst13-1' }],
        target: { instance: 'target13' }
      }
    }
  });

  const tasks = mapping.generateExecutionPlan();

  t.is(tasks.length, 3);
  
  const v11Tasks = tasks.filter(t => t.version === '11');
  t.is(v11Tasks.length, 2);
  t.is(v11Tasks[0].target.instance, 'target11');
  
  const v13Tasks = tasks.filter(t => t.version === '13');
  t.is(v13Tasks.length, 1);
  t.is(v13Tasks[0].target.instance, 'target13');
});

test('generateExecutionPlan - custom mapping', (t) => {
  const mapping = new MigrationMapping({
    strategy: 'custom-mapping',
    migrations: [
      {
        sources: ['inst1', 'inst2'],
        target: { instance: 'target1' },
        databases: ['db1', 'db2']
      },
      {
        source: { instance: 'inst3' },
        target: { instance: 'target2' },
        includeAll: true
      }
    ]
  });

  const tasks = mapping.generateExecutionPlan();

  t.is(tasks.length, 3);
  t.is(tasks[0].source.instance, 'inst1');
  t.is(tasks[1].source.instance, 'inst2');
  t.is(tasks[2].source.instance, 'inst3');
  t.true(tasks[2].includeAll);
});

// Test validation
test('validate - valid simple strategy', (t) => {
  const mapping = new MigrationMapping({
    strategy: 'simple',
    sources: [{ instance: 'inst1' }],
    targets: [{ instance: 'target1' }]
  });

  const result = mapping.validate();

  t.true(result.valid);
  t.is(result.errors.length, 0);
});

test('validate - invalid strategy', (t) => {
  const mapping = new MigrationMapping({
    strategy: 'invalid-strategy'
  });

  const result = mapping.validate();

  t.false(result.valid);
  t.true(result.errors.includes('Invalid strategy: invalid-strategy'));
});

test('validate - missing sources', (t) => {
  const mapping = new MigrationMapping({
    strategy: 'simple',
    sources: [],
    targets: [{ instance: 'target1' }]
  });

  const result = mapping.validate();

  t.false(result.valid);
  t.true(result.errors.includes('At least one source instance is required'));
});

test('validate - warns about N:1 with fail resolution', (t) => {
  const mapping = new MigrationMapping({
    strategy: 'consolidate',
    sources: [{ instance: 'inst1' }, { instance: 'inst2' }],
    targets: [{ instance: 'target1' }],
    conflictResolution: 'fail'
  });

  const result = mapping.validate();

  t.true(result.valid);
  t.true(result.warnings.length > 0);
  t.true(result.warnings[0].includes('N:1 mapping with "fail" conflict resolution'));
});

// Test conflict resolution
test('resolveDatabaseConflicts - no conflicts', (t) => {
  const mapping = new MigrationMapping({ conflictResolution: 'fail' });
  
  const databases = [
    { name: 'db1', source: { instance: 'inst1' } },
    { name: 'db2', source: { instance: 'inst2' } }
  ];

  const resolved = mapping.resolveDatabaseConflicts(databases);

  t.is(resolved.length, 2);
  t.is(resolved[0].name, 'db1');
  t.is(resolved[1].name, 'db2');
});

test('resolveDatabaseConflicts - prefix resolution', (t) => {
  const mapping = new MigrationMapping({ conflictResolution: 'prefix' });
  
  const databases = [
    { name: 'users', source: { project: 'proj1', instance: 'inst1' } },
    { name: 'users', source: { project: 'proj2', instance: 'inst2' } }
  ];

  const resolved = mapping.resolveDatabaseConflicts(databases);

  t.is(resolved.length, 2);
  t.is(resolved[0].name, 'inst1_users');
  t.is(resolved[1].name, 'inst2_users');
});

test('resolveDatabaseConflicts - suffix resolution', (t) => {
  const mapping = new MigrationMapping({ conflictResolution: 'suffix' });
  
  const databases = [
    { name: 'users', source: { instance: 'inst1' } },
    { name: 'users', source: { instance: 'inst2' } }
  ];

  const resolved = mapping.resolveDatabaseConflicts(databases);

  t.is(resolved.length, 2);
  t.is(resolved[0].name, 'users');
  t.is(resolved[1].name, 'users_2');
});

test('resolveDatabaseConflicts - fail on conflict', (t) => {
  const mapping = new MigrationMapping({ conflictResolution: 'fail' });
  
  const databases = [
    { name: 'users', source: { instance: 'inst1' } },
    { name: 'users', source: { instance: 'inst2' } }
  ];

  t.throws(() => mapping.resolveDatabaseConflicts(databases), {
    message: /Database name conflict: users exists in multiple sources/
  });
});

// Test version grouping
test('groupByVersion - groups instances by version', (t) => {
  const instances = [
    { instance: 'inst1', version: '11' },
    { instance: 'inst2', version: '11' },
    { instance: 'inst3', version: '13' },
    { instance: 'inst4' } // No version
  ];

  const mapping = new MigrationMapping();
  const grouped = mapping.groupByVersion(instances);

  t.truthy(grouped['11']);
  t.is(grouped['11'].length, 2);
  t.truthy(grouped['13']);
  t.is(grouped['13'].length, 1);
  t.truthy(grouped['unknown']);
  t.is(grouped['unknown'].length, 1);
});

// Test conversion to operation configs
test('toOperationConfigs - generates configs for each task', (t) => {
  const mapping = new MigrationMapping({
    strategy: 'simple',
    sources: [{ project: 'p1', instance: 'inst1' }],
    targets: [{ project: 'p2', instance: 'target1' }]
  });

  const configs = mapping.toOperationConfigs();

  t.is(configs.length, 1);
  t.is(configs[0].source.project, 'p1');
  t.is(configs[0].source.instance, 'inst1');
  t.is(configs[0].target.project, 'p2');
  t.is(configs[0].target.instance, 'target1');
  t.is(configs[0].metadata.toolName, 'gcp.cloudsql.migrate');
  t.is(configs[0].metadata.mappingStrategy, 'simple');
});

// Test summary generation
test('getSummary - returns comprehensive summary', (t) => {
  const mapping = new MigrationMapping({
    strategy: 'consolidate',
    sources: [{ instance: 'inst1' }, { instance: 'inst2' }],
    targets: [{ instance: 'target1' }],
    conflictResolution: 'prefix'
  });

  const summary = mapping.getSummary();

  t.is(summary.strategy, 'consolidate');
  t.is(summary.mappingType, 'N:1');
  t.is(summary.totalSources, 2);
  t.is(summary.totalTargets, 1);
  t.is(summary.totalMigrations, 2);
  t.is(summary.conflictResolution, 'prefix');
  t.is(summary.tasks.length, 2);
});

// Test cloning
test('clone - creates modified copy', (t) => {
  const original = new MigrationMapping({
    strategy: 'simple',
    sources: [{ instance: 'inst1' }]
  });

  const cloned = original.clone({
    conflictResolution: 'prefix'
  });

  t.is(cloned.strategy, 'simple');
  t.is(cloned.sources.length, 1);
  t.is(cloned.conflictResolution, 'prefix');
  t.not(cloned, original);
});

// Test JSON conversion
test('toJSON - returns complete representation', (t) => {
  const mapping = new MigrationMapping({
    strategy: 'version-based',
    versionMapping: { '11': { sources: [], target: {} } }
  });

  const json = mapping.toJSON();

  t.is(json.strategy, 'version-based');
  t.truthy(json.versionMapping);
  t.truthy(json.metadata);
  t.truthy(json.metadata.createdAt);
});

// Test static factory method
test('fromParserOutput - creates mapping from parser output', (t) => {
  const parserOutput = {
    strategy: 'consolidate',
    sources: [{ instance: 'inst1' }],
    targets: [{ instance: 'target1' }]
  };

  const mapping = MigrationMapping.fromParserOutput(parserOutput);

  t.is(mapping.strategy, 'consolidate');
  t.is(mapping.sources.length, 1);
  t.is(mapping.targets.length, 1);
});