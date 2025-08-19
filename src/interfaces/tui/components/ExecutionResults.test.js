import test from 'ava';
import React from 'react';
import { render } from 'ink-testing-library';
import sinon from 'sinon';
import ExecutionResults from './ExecutionResults.js';

test('ExecutionResults renders success result', (t) => {
  const result = {
    success: true,
    message: 'Migration completed successfully',
    duration: 30000,
    stats: { migrated: 5, errors: 0 }
  };
  const config = { source: { project: 'test-project' } };
  const onContinue = sinon.stub();

  const { lastFrame, unmount } = render(
    React.createElement(ExecutionResults, {
      result,
      config,
      error: null,
      onContinue
    })
  );

  const output = lastFrame();
  t.true(output.includes('Migration completed successfully'));
  t.true(
    output.includes('success') ||
      output.includes('✓') ||
      output.includes('completed')
  );

  // Clean up
  unmount();
});

test('ExecutionResults renders error result', (t) => {
  const error = new Error('Connection failed');
  const config = { source: { project: 'test-project' } };
  const onContinue = sinon.stub();

  const { lastFrame, unmount } = render(
    React.createElement(ExecutionResults, {
      result: null,
      config,
      error,
      onContinue
    })
  );

  const output = lastFrame();
  t.true(output.includes('Connection failed'));
  t.true(
    output.includes('error') ||
      output.includes('✗') ||
      output.includes('failed')
  );

  // Clean up
  unmount();
});

test('ExecutionResults renders failure result', (t) => {
  const result = {
    success: false,
    message: 'Migration failed',
    error: 'Database connection timeout'
  };
  const config = { source: { project: 'test-project' } };
  const onContinue = sinon.stub();

  const { lastFrame, unmount } = render(
    React.createElement(ExecutionResults, {
      result,
      config,
      error: null,
      onContinue
    })
  );

  const output = lastFrame();
  t.true(
    output.includes('Migration failed') ||
      output.includes('Database connection timeout')
  );

  // Clean up
  unmount();
});

test('ExecutionResults includes continue instruction', (t) => {
  const result = { success: true, message: 'Success' };
  const config = { source: { project: 'test-project' } };
  const onContinue = sinon.stub();

  const { lastFrame, unmount } = render(
    React.createElement(ExecutionResults, {
      result,
      config,
      error: null,
      onContinue
    })
  );

  const output = lastFrame();
  t.true(
    output.includes('Press any key') ||
      output.includes('Continue') ||
      output.includes('Enter')
  );

  // Clean up
  unmount();
});

test('ExecutionResults handles null result and error', (t) => {
  const config = { source: { project: 'test-project' } };
  const onContinue = sinon.stub();

  const { lastFrame, unmount } = render(
    React.createElement(ExecutionResults, {
      result: null,
      config,
      error: null,
      onContinue
    })
  );

  const output = lastFrame();
  // Should render something even with null inputs
  t.true(typeof output === 'string');

  // Clean up
  unmount();
});

test('ExecutionResults creates instance with required props', (t) => {
  const result = { success: true, message: 'Test' };
  const config = {};
  const onContinue = sinon.stub();

  const { unmount } = render(
    React.createElement(ExecutionResults, {
      result,
      config,
      error: null,
      onContinue
    })
  );

  // Should render without throwing
  t.pass();
  unmount();
});
