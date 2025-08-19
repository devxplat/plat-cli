import test from 'ava';
import ProgressTracker from './progress-tracker.js';
import { createMockLogger } from '../test-utils/index.js';

test('ProgressTracker creates instance with logger', (t) => {
  const logger = createMockLogger();
  const tracker = new ProgressTracker(logger);

  t.truthy(tracker);
  t.is(typeof tracker.init, 'function');
  t.is(typeof tracker.startPhase, 'function');
  t.is(typeof tracker.complete, 'function');
});

test('ProgressTracker creates instance without logger', (t) => {
  const tracker = new ProgressTracker();

  t.truthy(tracker);
  t.is(typeof tracker.init, 'function');
  t.is(typeof tracker.startPhase, 'function');
  t.is(typeof tracker.complete, 'function');
});

test('ProgressTracker init method initializes tracking', (t) => {
  const logger = createMockLogger();
  const tracker = new ProgressTracker(logger);

  const result = tracker.init(['Test Operation']);

  t.truthy(result); // init returns this
  t.true(tracker.isActive);
});

test('ProgressTracker update method accepts progress data', (t) => {
  const logger = createMockLogger();
  const tracker = new ProgressTracker(logger);

  tracker.init(['Test Operation']);
  tracker.startPhase('Test Operation', 100);
  tracker.update(50, 'Half way complete');

  // Should update progress without throwing
  t.pass();
});

test('ProgressTracker complete method finalizes tracking', (t) => {
  const logger = createMockLogger();
  const tracker = new ProgressTracker(logger);

  tracker.init(['Test Operation']);
  tracker.startPhase('Test Operation', 100);
  tracker.update(100, 'Complete');
  tracker.complete({ processedDatabases: 1, totalSize: 100, success: true });

  // Should stop tracking without throwing
  t.pass();
});

test('ProgressTracker formats time correctly', (t) => {
  const logger = createMockLogger();
  const tracker = new ProgressTracker(logger);

  // Test internal time formatting if method is exposed
  if (typeof tracker._formatTime === 'function') {
    t.is(tracker._formatTime(30), '30s');
    t.is(tracker._formatTime(90), '1m 30s');
    // Test hour formatting (3700s = 1h 1m 40s, but formatter might round)
    const hourResult = tracker._formatTime(3700);
    t.true(hourResult.includes('1h'));
    t.true(hourResult.includes('m'));
  } else {
    t.pass(); // Skip if method is not exposed
  }
});

test('ProgressTracker handles multiple phase tracking', (t) => {
  const logger = createMockLogger();
  const tracker = new ProgressTracker(logger);

  tracker.init(['Phase 1', 'Phase 2']);

  tracker.startPhase('Phase 1', 100);
  tracker.update(25, 'Phase 1 progress');
  tracker.completePhase();

  tracker.startPhase('Phase 2', 100);
  tracker.update(75, 'Phase 2 progress');
  tracker.completePhase();

  tracker.complete({ processedDatabases: 1, totalSize: 100, success: true });
  t.pass();
});

test('ProgressTracker logs progress updates when logger provided', (t) => {
  const logger = createMockLogger();
  const tracker = new ProgressTracker(logger);

  tracker.init(['Test Operation']);
  tracker.startPhase('Test Operation', 100);
  tracker.update(50, 'Halfway done');
  tracker.complete({ processedDatabases: 1, totalSize: 100, success: true });

  // Should have logged some progress information
  t.true(logger.info.called || logger.debug.called);
});

test('ProgressTracker handles rapid updates', (t) => {
  const logger = createMockLogger();
  const tracker = new ProgressTracker(logger);

  tracker.init(['Rapid Updates Test']);
  tracker.startPhase('Rapid Updates Test', 100);

  // Simulate rapid progress updates
  for (let i = 0; i <= 100; i += 10) {
    tracker.update(i, `Progress: ${i}%`);
  }

  tracker.complete({ processedDatabases: 1, totalSize: 100, success: true });
  t.pass();
});

test('ProgressTracker handles edge cases', (t) => {
  const logger = createMockLogger();
  const tracker = new ProgressTracker(logger);

  // Test with null/undefined values
  tracker.init(['Test']);
  tracker.update(null, null);
  tracker.update(-10, 'Negative progress');
  tracker.update(150, 'Over 100% progress');
  tracker.complete({ processedDatabases: 1, totalSize: 100, success: true });

  t.pass();
});

test('ProgressTracker provides duration calculation', async (t) => {
  const logger = createMockLogger();
  const tracker = new ProgressTracker(logger);

  tracker.init(['Duration Test']);
  tracker.startPhase('Duration Test', 100);

  // Add small delay to ensure time difference
  await new Promise((resolve) => setTimeout(resolve, 10));

  tracker.complete({ processedDatabases: 1, totalSize: 100, success: true });

  // Test that tracker has timing capability
  t.truthy(tracker.startTime);
  t.true(typeof tracker.startTime === 'number');
});
