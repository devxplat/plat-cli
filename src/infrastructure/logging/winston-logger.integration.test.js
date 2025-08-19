import test from 'ava';
import Logger from './winston-logger.js';
import ProgressTracker from '../../application/progress-tracker.js';

// Integration tests for Logger with real instances
test('Logger creates instance correctly', (t) => {
  const logger = new Logger({
    level: 'debug',
    enableFile: false,
    cliMode: true
  });
  t.truthy(logger);
  t.is(typeof logger.info, 'function');
  t.is(typeof logger.error, 'function');
  t.is(typeof logger.debug, 'function');
  t.is(typeof logger.warn, 'function');
});

test('Logger supports CLI mode', (t) => {
  const logger = new Logger({
    cliMode: true,
    enableFile: false,
    quiet: false
  });

  t.truthy(logger);
  t.is(typeof logger.setCLIMode, 'function');
  t.is(typeof logger.setQuiet, 'function');
  t.is(typeof logger.setProgressTracker, 'function');
});

test('Logger integrates with ProgressTracker', (t) => {
  const logger = new Logger({ enableFile: false, cliMode: true });
  const progressTracker = new ProgressTracker(logger);

  // Set up the integration
  logger.setProgressTracker(progressTracker);

  t.truthy(logger);
  t.truthy(progressTracker);
  t.is(progressTracker.logger, logger);
});
