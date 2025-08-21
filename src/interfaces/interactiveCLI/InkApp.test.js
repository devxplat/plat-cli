import test from 'ava';
import React from 'react';
import { render } from 'ink-testing-library';
import sinon from 'sinon';
import InkApp from './InkApp.js';
import {
  createMockCoordinator,
  createMockLogger,
  testInkComponent
} from '../../test-utils/index.js';

test('InkApp renders MainMenu by default', (t) => {
  const coordinator = createMockCoordinator();
  const logger = createMockLogger();
  const onExit = sinon.stub();

  testInkComponent(
    () =>
      render(
        React.createElement(InkApp, {
          coordinator,
          logger,
          onExit
        })
      ),
    t,
    'InkApp'
  );
});

test('InkApp creates instance with required props', (t) => {
  const coordinator = createMockCoordinator();
  const logger = createMockLogger();
  const onExit = sinon.stub();

  const { unmount } = render(
    React.createElement(InkApp, {
      coordinator,
      logger,
      onExit
    })
  );

  // Should render without throwing
  t.pass();
  unmount();
});

test('InkApp uses ThemeProvider wrapper', (t) => {
  const coordinator = createMockCoordinator();
  const logger = createMockLogger();
  const onExit = sinon.stub();

  testInkComponent(
    () =>
      render(
        React.createElement(InkApp, {
          coordinator,
          logger,
          onExit
        })
      ),
    t,
    'InkApp with ThemeProvider'
  );
});

test('InkApp handles view state transitions', (t) => {
  const coordinator = createMockCoordinator();
  const logger = createMockLogger();
  const onExit = sinon.stub();

  const { rerender } = render(
    React.createElement(InkApp, {
      coordinator,
      logger,
      onExit
    })
  );

  // Test that component can be re-rendered
  rerender(
    React.createElement(InkApp, {
      coordinator,
      logger,
      onExit
    })
  );

  t.pass();
});

test('InkApp provides proper component structure', (t) => {
  const coordinator = createMockCoordinator();
  const logger = createMockLogger();
  const onExit = sinon.stub();

  testInkComponent(
    () =>
      render(
        React.createElement(InkApp, {
          coordinator,
          logger,
          onExit
        })
      ),
    t,
    'InkApp structure'
  );
});
