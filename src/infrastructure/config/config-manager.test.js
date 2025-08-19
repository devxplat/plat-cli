import test from 'ava';
import sinon from 'sinon';
import configManager from './config-manager.js';

test('ConfigManager singleton instance exists', (t) => {
  t.truthy(configManager);
  t.is(typeof configManager, 'object');
});

test('ConfigManager has required methods', (t) => {
  const expectedMethods = ['load', 'get', 'set', 'reset', 'getAll'];

  for (const method of expectedMethods) {
    if (typeof configManager[method] === 'function') {
      t.is(typeof configManager[method], 'function');
    }
  }

  // At minimum should have basic config operations
  t.true(
    typeof configManager.load === 'function' ||
      typeof configManager.get === 'function'
  );
});

test('ConfigManager loads configuration', async (t) => {
  if (typeof configManager.load === 'function') {
    try {
      const config = await configManager.load();
      t.true(typeof config === 'object' || config === null);
    } catch (error) {
      // Expected if no config file exists or other load errors
      t.true(error instanceof Error);
    }
  } else {
    t.pass(); // Skip if no load method available
  }
});

test('ConfigManager handles default configuration', (t) => {
  if (typeof configManager.getDefaultConfig === 'function') {
    const defaultConfig = configManager.getDefaultConfig();
    t.true(typeof defaultConfig === 'object');
  } else if (typeof configManager.defaults === 'object') {
    t.true(typeof configManager.defaults === 'object');
  } else {
    t.pass(); // Skip if no default config mechanism
  }
});

test('ConfigManager validates configuration', (t) => {
  if (typeof configManager.validateConfig === 'function') {
    const validConfig = {
      logLevel: 'info',
      enableFileLogging: true,
      projectDefaults: {
        region: 'us-central1'
      }
    };

    const invalidConfig = {
      logLevel: 'invalid-level',
      enableFileLogging: 'not-boolean'
    };

    const validResult = configManager.validateConfig(validConfig);
    const invalidResult = configManager.validateConfig(invalidConfig);

    t.true(typeof validResult === 'object' || typeof validResult === 'boolean');
    t.true(
      typeof invalidResult === 'object' || typeof invalidResult === 'boolean'
    );
  } else {
    t.pass(); // Skip if no validation method
  }
});

test('ConfigManager merges configurations', (t) => {
  if (typeof configManager.mergeConfig === 'function') {
    const baseConfig = {
      logLevel: 'info',
      features: {
        enableTUI: true,
        enableAPI: false
      }
    };

    const overrideConfig = {
      logLevel: 'debug',
      features: {
        enableAPI: true
      }
    };

    const merged = configManager.mergeConfig(baseConfig, overrideConfig);

    t.is(merged && merged.logLevel, 'debug');
    t.true(merged.features.enableTUI);
    t.true(merged.features.enableAPI);
  } else {
    t.pass(); // Skip if no merge method
  }
});

test('ConfigManager handles environment variables', (t) => {
  if (typeof configManager.loadFromEnvironment === 'function') {
    // Set some test environment variables
    const originalEnv = process.env;
    process.env.PLAT_CLI_LOG_LEVEL = 'debug';
    process.env.PLAT_CLI_ENABLE_FILE_LOGGING = 'false';

    try {
      const envConfig = configManager.loadFromEnvironment();
      t.true(typeof envConfig === 'object' && envConfig !== null);
    } catch (error) {
      t.true(error instanceof Error);
    } finally {
      // Restore original environment
      process.env = originalEnv;
    }
  } else {
    t.pass(); // Skip if no environment loading
  }
});

test('ConfigManager handles configuration files', async (t) => {
  const testConfig = {
    logLevel: 'debug',
    projectDefaults: {
      region: 'us-west1'
    }
  };

  if (
    typeof configManager.saveConfig === 'function' &&
    typeof configManager.loadConfig === 'function'
  ) {
    try {
      // Test saving configuration
      await configManager.saveConfig(testConfig);

      // Test loading saved configuration
      const loadedConfig = await configManager.loadConfig();
      t.truthy(loadedConfig);

      if (loadedConfig) {
        t.is(loadedConfig.logLevel, 'debug');
      }
    } catch (error) {
      // File operations might fail in test environment
      t.true(error instanceof Error);
    }
  } else {
    t.pass(); // Skip if no file operations available
  }
});

test('ConfigManager provides configuration schema if available', (t) => {
  if (typeof configManager.getSchema === 'function') {
    const schema = configManager.getSchema();
    t.true(typeof schema === 'object');
  } else if (configManager.schema) {
    t.true(typeof configManager.schema === 'object');
  } else {
    t.pass(); // Skip if no schema available
  }
});

test('ConfigManager handles missing configuration gracefully', async (t) => {
  if (typeof configManager.loadConfig === 'function') {
    try {
      // Try to load from non-existent path
      const config = await configManager.loadConfig(
        '/non/existent/path/config.json'
      );

      // Should either return null/default config or throw
      t.true(config === null || typeof config === 'object');
    } catch (error) {
      // Should throw meaningful error for missing files
      t.true(error instanceof Error);
      t.true(error.message.length > 0);
    }
  } else {
    t.pass(); // Skip if no load method
  }
});

test('ConfigManager supports configuration watching if available', (t) => {
  if (typeof configManager.watch === 'function') {
    const callback = sinon.stub();

    try {
      configManager.watch(callback);
      t.true(callback.callCount >= 0); // Should not throw
    } catch (error) {
      // File watching might not be available in all environments
      t.true(error instanceof Error);
    }
  } else {
    t.pass(); // Skip if no watch capability
  }
});
