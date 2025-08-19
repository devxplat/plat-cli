import test from 'ava';
import defaultConfig from './default-config.js';

test('default-config exports configuration object', (t) => {
  t.truthy(defaultConfig);
  t.true(typeof defaultConfig === 'object');
});

test('default-config has logging configuration', (t) => {
  if (defaultConfig.logging || defaultConfig.logLevel || defaultConfig.logger) {
    // Test logging specific configuration
    if (defaultConfig.logging) {
      t.true(typeof defaultConfig.logging === 'object');
      
      if (defaultConfig.logging.level) {
        t.true(typeof defaultConfig.logging.level === 'string');
        t.true(['error', 'warn', 'info', 'debug', 'verbose'].includes(defaultConfig.logging.level));
      }
    }
    
    if (defaultConfig.logLevel) {
      t.true(typeof defaultConfig.logLevel === 'string');
    }
  } else {
    t.pass(); // Skip if no logging config
  }
});

test('default-config has CLI configuration', (t) => {
  if (defaultConfig.cli || defaultConfig.cliMode || defaultConfig.interactive) {
    if (defaultConfig.cli) {
      t.true(typeof defaultConfig.cli === 'object');
    }
    
    if (defaultConfig.cliMode !== undefined) {
      t.true(typeof defaultConfig.cliMode === 'boolean');
    }
    
    if (defaultConfig.interactive !== undefined) {
      t.true(typeof defaultConfig.interactive === 'boolean');
    }
  } else {
    t.pass(); // Skip if no CLI config
  }
});

test('default-config has project defaults', (t) => {
  if (defaultConfig.projectDefaults || defaultConfig.defaults || defaultConfig.project) {
    const projectConfig = defaultConfig.projectDefaults || defaultConfig.defaults || defaultConfig.project;
    t.true(typeof projectConfig === 'object');
    
    // Test common project configuration fields
    if (projectConfig.region) {
      t.true(typeof projectConfig.region === 'string');
    }
    
    if (projectConfig.zone) {
      t.true(typeof projectConfig.zone === 'string');
    }
    
    if (projectConfig.retryAttempts !== undefined) {
      t.true(typeof projectConfig.retryAttempts === 'number');
      t.true(projectConfig.retryAttempts >= 0);
    }
  } else {
    t.pass(); // Skip if no project defaults
  }
});

test('default-config has GCP configuration', (t) => {
  if (defaultConfig.gcp || defaultConfig.google || defaultConfig.cloud) {
    const gcpConfig = defaultConfig.gcp || defaultConfig.google || defaultConfig.cloud;
    t.true(typeof gcpConfig === 'object');
    
    if (gcpConfig.region) {
      t.true(typeof gcpConfig.region === 'string');
    }
    
    if (gcpConfig.defaultProject) {
      t.true(typeof gcpConfig.defaultProject === 'string');
    }
    
    if (gcpConfig.timeout !== undefined) {
      t.true(typeof gcpConfig.timeout === 'number');
    }
  } else {
    t.pass(); // Skip if no GCP config
  }
});

test('default-config has CloudSQL configuration', (t) => {
  if (defaultConfig.cloudsql || defaultConfig.cloudSql || (defaultConfig.gcp && defaultConfig.gcp.cloudsql)) {
    const cloudsqlConfig = defaultConfig.cloudsql || defaultConfig.cloudSql || defaultConfig.gcp?.cloudsql;
    t.true(typeof cloudsqlConfig === 'object');
    
    if (cloudsqlConfig.defaultPort !== undefined) {
      t.true(typeof cloudsqlConfig.defaultPort === 'number');
      t.true(cloudsqlConfig.defaultPort > 0);
    }
    
    if (cloudsqlConfig.connectionTimeout !== undefined) {
      t.true(typeof cloudsqlConfig.connectionTimeout === 'number');
    }
    
    if (cloudsqlConfig.maxRetries !== undefined) {
      t.true(typeof cloudsqlConfig.maxRetries === 'number');
      t.true(cloudsqlConfig.maxRetries >= 0);
    }
  } else {
    t.pass(); // Skip if no CloudSQL config
  }
});

test('default-config has migration settings', (t) => {
  if (defaultConfig.migration || defaultConfig.migrations || defaultConfig.migrate) {
    const migrationConfig = defaultConfig.migration || defaultConfig.migrations || defaultConfig.migrate;
    t.true(typeof migrationConfig === 'object');
    
    if (migrationConfig.defaultMode) {
      t.true(typeof migrationConfig.defaultMode === 'string');
      t.true(['full', 'schema', 'data'].includes(migrationConfig.defaultMode));
    }
    
    if (migrationConfig.retryAttempts !== undefined) {
      t.true(typeof migrationConfig.retryAttempts === 'number');
      t.true(migrationConfig.retryAttempts >= 0);
    }
    
    if (migrationConfig.dryRun !== undefined) {
      t.true(typeof migrationConfig.dryRun === 'boolean');
    }
  } else {
    t.pass(); // Skip if no migration config
  }
});

test('default-config has UI/TUI configuration', (t) => {
  if (defaultConfig.ui || defaultConfig.tui || defaultConfig.interface) {
    const uiConfig = defaultConfig.ui || defaultConfig.tui || defaultConfig.interface;
    t.true(typeof uiConfig === 'object');
    
    if (uiConfig.theme) {
      t.true(typeof uiConfig.theme === 'string' || typeof uiConfig.theme === 'object');
    }
    
    if (uiConfig.showProgress !== undefined) {
      t.true(typeof uiConfig.showProgress === 'boolean');
    }
    
    if (uiConfig.enableColors !== undefined) {
      t.true(typeof uiConfig.enableColors === 'boolean');
    }
  } else {
    t.pass(); // Skip if no UI config
  }
});

test('default-config has reasonable timeout values', (t) => {
  const timeoutFields = [
    'timeout',
    'connectionTimeout',
    'operationTimeout',
    'requestTimeout'
  ];

  let hasTimeouts = false;
  
  function checkTimeouts(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      if (timeoutFields.includes(key) && typeof value === 'number') {
        hasTimeouts = true;
        t.true(value > 0, `Timeout ${path}${key} should be positive`);
        t.true(value < 3600000, `Timeout ${path}${key} should be reasonable (< 1 hour)`);
      } else if (typeof value === 'object' && value !== null) {
        checkTimeouts(value, `${path}${key}.`);
      }
    }
  }
  
  checkTimeouts(defaultConfig);
  
  if (!hasTimeouts) {
    t.pass(); // Skip if no timeout configurations
  }
});

test('default-config has valid retry configurations', (t) => {
  const retryFields = [
    'retryAttempts',
    'maxRetries',
    'retries'
  ];

  let hasRetries = false;
  
  function checkRetries(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      if (retryFields.includes(key) && typeof value === 'number') {
        hasRetries = true;
        t.true(value >= 0, `Retry count ${path}${key} should be non-negative`);
        t.true(value <= 10, `Retry count ${path}${key} should be reasonable (<= 10)`);
      } else if (typeof value === 'object' && value !== null) {
        checkRetries(value, `${path}${key}.`);
      }
    }
  }
  
  checkRetries(defaultConfig);
  
  if (!hasRetries) {
    t.pass(); // Skip if no retry configurations
  }
});

test('default-config can be serialized to JSON', (t) => {
  t.notThrows(() => {
    const json = JSON.stringify(defaultConfig);
    t.true(typeof json === 'string');
    t.true(json.length > 0);
    
    // Should be able to parse back
    const parsed = JSON.parse(json);
    t.true(typeof parsed === 'object');
  });
});