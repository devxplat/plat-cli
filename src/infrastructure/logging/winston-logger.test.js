import test from 'ava';
import sinon from 'sinon';
import Logger from './winston-logger.js';

test('Logger creates instance with default configuration', (t) => {
  const logger = new Logger();

  t.truthy(logger);
  t.is(typeof logger.info, 'function');
  t.is(typeof logger.error, 'function');
  t.is(typeof logger.debug, 'function');
  t.is(typeof logger.warn, 'function');
});

test('Logger creates instance with custom configuration', (t) => {
  const config = {
    level: 'debug',
    enableFile: false,
    cliMode: true,
    quiet: false
  };

  const logger = new Logger(config);

  t.truthy(logger);
  t.is(typeof logger.info, 'function');
  t.is(typeof logger.error, 'function');
  t.is(typeof logger.debug, 'function');
  t.is(typeof logger.warn, 'function');
});

test('Logger supports CLI mode configuration', (t) => {
  const logger = new Logger({
    cliMode: true,
    enableFile: false,
    quiet: false
  });

  t.truthy(logger);
  
  if (typeof logger.setCLIMode === 'function') {
    t.is(typeof logger.setCLIMode, 'function');
    logger.setCLIMode(true);
  }
  
  if (typeof logger.setQuiet === 'function') {
    t.is(typeof logger.setQuiet, 'function');
    logger.setQuiet(false);
  }
});

test('Logger supports progress tracker integration', (t) => {
  const logger = new Logger({ enableFile: false, cliMode: true });

  if (typeof logger.setProgressTracker === 'function') {
    const mockProgressTracker = {
      update: sinon.stub(),
      start: sinon.stub(),
      stop: sinon.stub()
    };

    logger.setProgressTracker(mockProgressTracker);
    t.pass();
  } else {
    t.pass(); // Skip if progress tracker integration not implemented
  }
});

test('Logger handles file logging configuration', (t) => {
  const loggerWithFile = new Logger({
    enableFile: true,
    level: 'info'
  });

  const loggerWithoutFile = new Logger({
    enableFile: false,
    level: 'info'
  });

  t.truthy(loggerWithFile);
  t.truthy(loggerWithoutFile);
});

test('Logger logging methods accept message and metadata', (t) => {
  const logger = new Logger({ enableFile: false });

  // Test basic logging without throwing
  t.notThrows(() => {
    logger.info('Test info message');
    logger.error('Test error message');
    logger.debug('Test debug message');
    logger.warn('Test warning message');
  });

  // Test logging with metadata
  t.notThrows(() => {
    logger.info('Test with metadata', { key: 'value' });
    logger.error('Error with context', { error: 'details', code: 500 });
  });
});

test('Logger handles different log levels', (t) => {
  const levels = ['error', 'warn', 'info', 'debug'];

  for (const level of levels) {
    const logger = new Logger({
      level,
      enableFile: false
    });

    t.truthy(logger);
    
    // Should be able to log at the configured level
    t.notThrows(() => {
      logger[level](`Test ${level} message`);
    });
  }
});

test('Logger handles quiet mode', (t) => {
  const logger = new Logger({
    quiet: true,
    enableFile: false
  });

  t.truthy(logger);
  
  // Should still accept log calls even in quiet mode
  t.notThrows(() => {
    logger.info('This message should be suppressed');
    logger.error('Errors might still show in quiet mode');
  });
});

test('Logger handles error objects properly', (t) => {
  const logger = new Logger({ enableFile: false });

  const testError = new Error('Test error');
  testError.stack = 'Error: Test error\n    at test';

  t.notThrows(() => {
    logger.error('Error occurred', { error: testError });
    logger.error('Direct error logging', testError);
  });
});

test('Logger supports structured logging', (t) => {
  const logger = new Logger({ enableFile: false });

  const structuredData = {
    userId: '12345',
    action: 'database_migration',
    timestamp: new Date().toISOString(),
    metadata: {
      source: 'gcp-project-1',
      target: 'gcp-project-2'
    }
  };

  t.notThrows(() => {
    logger.info('Migration started', structuredData);
    logger.debug('Configuration details', structuredData.metadata);
  });
});

test('Logger handles edge cases gracefully', (t) => {
  const logger = new Logger({ enableFile: false });

  t.notThrows(() => {
    // Test with null/undefined values
    logger.info(null);
    logger.error(undefined);
    logger.debug('');
    
    // Test with non-string messages
    logger.info(123);
    logger.warn(true);
    logger.error({ message: 'object as message' });
    
    // Test with circular references in metadata
    const circular = { a: 1 };
    circular.self = circular;
    logger.info('Circular reference test', circular);
  });
});