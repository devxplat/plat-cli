import test from 'ava';
import ProgressTracker from './progress-tracker.js';

// Integration tests for ProgressTracker with real instances
test('ProgressTracker creates instance correctly', (t) => {
  const progressTracker = new ProgressTracker();
  t.truthy(progressTracker);
  t.is(typeof progressTracker.init, 'function');
  t.is(typeof progressTracker.startPhase, 'function');
  t.is(typeof progressTracker.update, 'function');
  t.is(typeof progressTracker.complete, 'function');
});

test('ProgressTracker formats time correctly', (t) => {
  const progressTracker = new ProgressTracker();

  // Test time formatting
  t.is(progressTracker._formatTime(30), '00:30');
  t.is(progressTracker._formatTime(90), '01:30');
  t.is(progressTracker._formatTime(3700), '01:01:40');
});

test('ProgressTracker formats bytes correctly', (t) => {
  const progressTracker = new ProgressTracker();

  // Test byte formatting
  t.is(progressTracker._formatBytes(0), '0 B');
  t.is(progressTracker._formatBytes(1024), '1 KB');
  t.is(progressTracker._formatBytes(1048576), '1 MB');
  t.is(progressTracker._formatBytes(1073741824), '1 GB');
});
