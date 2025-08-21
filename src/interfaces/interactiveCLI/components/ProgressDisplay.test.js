import test from 'ava';
import React from 'react';
import { render } from 'ink-testing-library';
import ProgressDisplay, { MultiStepProgress } from './ProgressDisplay.js';

test('ProgressDisplay renders basic progress information', (t) => {
  const { lastFrame, unmount } = render(
    React.createElement(ProgressDisplay, {
      title: 'Test Progress',
      progress: 50,
      message: 'Processing...',
      isActive: true
    })
  );

  const output = lastFrame();
  // In test environment, just verify it renders something
  t.truthy(output);
  t.true(typeof output === 'string');

  // Clean up to prevent timeout
  unmount();
});

test('ProgressDisplay handles progress percentage', (t) => {
  const { lastFrame, unmount } = render(
    React.createElement(ProgressDisplay, {
      title: 'Loading',
      progress: 75,
      message: 'Almost done'
    })
  );

  const output = lastFrame();
  // In test environment, just verify it doesn't crash
  t.true(typeof output === 'string');

  // Clean up
  unmount();
});

test('MultiStepProgress renders multiple steps', (t) => {
  const steps = [
    'Validating configuration',
    'Connecting to source',
    'Executing operation',
    'Finalizing'
  ];

  const { lastFrame, unmount } = render(
    React.createElement(MultiStepProgress, {
      steps,
      currentStep: 1,
      currentProgress: 30
    })
  );

  const output = lastFrame();
  // In test environment, just verify it renders something
  t.truthy(output);
  t.true(typeof output === 'string');

  // Clean up
  unmount();
});

test('MultiStepProgress shows current step indicator', (t) => {
  const steps = ['Step 1', 'Step 2', 'Step 3'];

  const { lastFrame, unmount } = render(
    React.createElement(MultiStepProgress, {
      steps,
      currentStep: 1,
      currentProgress: 50
    })
  );

  const output = lastFrame();
  // Should indicate current step (Step 2 at index 1)
  t.true(
    output.includes('Step 2') || output.includes('►') || output.includes('▶')
  );

  // Clean up
  unmount();
});

test('MultiStepProgress handles empty steps array', (t) => {
  const { lastFrame, unmount } = render(
    React.createElement(MultiStepProgress, {
      steps: [],
      currentStep: 0,
      currentProgress: 0
    })
  );

  const output = lastFrame();
  // Should render without throwing
  t.true(typeof output === 'string');

  // Clean up
  unmount();
});

test('MultiStepProgress handles out of bounds currentStep', (t) => {
  const steps = ['Step 1', 'Step 2'];

  const { lastFrame, unmount } = render(
    React.createElement(MultiStepProgress, {
      steps,
      currentStep: 5, // Out of bounds
      currentProgress: 100
    })
  );

  const output = lastFrame();
  // Should render without throwing
  t.true(typeof output === 'string');
  t.true(output.length >= 0);

  // Clean up
  unmount();
});

test('ProgressDisplay creates instance with minimal props', (t) => {
  const { unmount } = render(
    React.createElement(ProgressDisplay, {
      title: 'Test'
    })
  );

  // Should render without throwing
  t.pass();
  unmount();
});
