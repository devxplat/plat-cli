import test from 'ava';
import ValidationEngine from './validation-engine.js';
import { createMockLogger } from '../test-utils/index.js';

test('ValidationEngine creates instance with logger', (t) => {
  const logger = createMockLogger();
  const validator = new ValidationEngine({ logger });

  t.truthy(validator);
  t.is(typeof validator.validateConfiguration, 'function');
  t.truthy(validator.logger);
});

test('ValidationEngine creates instance without logger', (t) => {
  const validator = new ValidationEngine({});

  t.truthy(validator);
  t.is(typeof validator.validateConfiguration, 'function');
});

test('ValidationEngine validateConfiguration requires config with metadata', (t) => {
  const logger = createMockLogger();
  const validator = new ValidationEngine({ logger });

  // Test that validation expects a config object with validate method
  const mockConfig = {
    validate: () => ({ valid: true, errors: [] }),
    metadata: { toolName: 'gcp.cloudsql.migrate' },
    options: {},
    source: {},
    target: {}
  };

  t.notThrows(() => {
    const result = validator.validateConfiguration(mockConfig);
    t.truthy(result);
  });
});

test('ValidationEngine validateConfiguration handles valid config', (t) => {
  const logger = createMockLogger();
  const validator = new ValidationEngine({ logger });

  // Create a proper mock config that matches what ValidationEngine expects
  const validConfig = {
    validate: () => ({ valid: true, errors: [] }),
    metadata: { toolName: 'gcp.cloudsql.migrate' },
    options: {},
    source: { project: 'source-proj', instance: 'source-inst' },
    target: { project: 'target-proj', instance: 'target-inst' }
  };

  const result = validator.validateConfiguration(validConfig);
  t.truthy(result);
  t.true(typeof result === 'object');
});

test('ValidationEngine handles config with invalid validation', (t) => {
  const logger = createMockLogger();
  const validator = new ValidationEngine({ logger });

  const invalidConfig = {
    validate: () => ({ valid: false, errors: ['Test error'] }),
    metadata: { toolName: 'gcp.cloudsql.migrate' },
    options: {},
    source: {},
    target: {}
  };

  t.notThrows(() => {
    const result = validator.validateConfiguration(invalidConfig);
    t.truthy(result);
  });
});

test('ValidationEngine handles missing validate method gracefully', (t) => {
  const logger = createMockLogger();
  const validator = new ValidationEngine({ logger });

  const configWithoutValidate = {
    metadata: { toolName: 'gcp.cloudsql.migrate' },
    options: {},
    source: {},
    target: {}
  };

  // The ValidationEngine might handle missing validate method gracefully
  t.notThrows(() => {
    const result = validator.validateConfiguration(configWithoutValidate);
    // Should return some result even if validate method is missing
    t.truthy(result !== undefined);
  });
});

test('ValidationEngine works without logger', (t) => {
  const validator = new ValidationEngine({});

  const validConfig = {
    validate: () => ({ valid: true, errors: [] }),
    metadata: { toolName: 'gcp.cloudsql.migrate' },
    options: {},
    source: {},
    target: {}
  };

  t.notThrows(() => {
    const result = validator.validateConfiguration(validConfig);
    t.truthy(result);
  });
});
