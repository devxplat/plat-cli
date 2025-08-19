import React from 'react';
import { Box, Text } from 'ink';
import { ProgressBar, Spinner } from '@inkjs/ui';

/**
 * Modern progress display using @inkjs/ui components
 * Uses ProgressBar for determinate progress and Spinner for indeterminate progress
 */
const ProgressDisplay = ({
  isActive = false,
  progress = 0,
  message = '',
  status = 'running',
  compact = true
}) => {
  if (!isActive) return null;

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'green';
      case 'error':
        return 'red';
      case 'warning':
        return 'yellow';
      default:
        return 'cyan';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      default:
        return null; // Let Spinner handle the icon for running state
    }
  };

  const statusColor = getStatusColor();
  const statusIcon = getStatusIcon();

  if (compact) {
    return React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      status === 'running' && !statusIcon
        ? React.createElement(Spinner, { label: message })
        : React.createElement(
            Text,
            { color: statusColor },
            `${statusIcon} ${message}${progress > 0 && status === 'running' ? ` (${Math.round(progress)}%)` : ''}`
          )
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1 },
      status === 'running' && !statusIcon
        ? React.createElement(Spinner, { label: message })
        : React.createElement(
            Text,
            { color: statusColor },
            `${statusIcon} ${message}`
          )
    ),
    progress > 0 &&
      status === 'running' &&
      React.createElement(
        Box,
        { flexDirection: 'column', gap: 1 },
        React.createElement(ProgressBar, { value: Math.round(progress) }),
        React.createElement(
          Text,
          { color: 'gray', dimColor: true },
          `${Math.round(progress)}% complete`
        )
      )
  );
};

/**
 * Enhanced multi-step progress using ink UI components
 * Shows current step with overall progress and step-specific progress
 */
const MultiStepProgress = ({
  steps = [],
  currentStep = 0,
  currentProgress = 0
}) => {
  if (steps.length === 0) return null;

  const currentStepName = steps[currentStep] || 'Complete';
  const isComplete = currentStep >= steps.length;

  // Calculate overall progress across all steps
  const overallProgress = isComplete
    ? 100
    : (currentStep / steps.length) * 100 +
      (currentProgress / steps.length / 100) * 100;

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    React.createElement(
      Text,
      { bold: true, color: 'cyan' },
      `Step ${Math.min(currentStep + 1, steps.length)}/${steps.length}: ${currentStepName}`
    ),
    React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        Text,
        { color: 'gray', dimColor: true },
        'Overall Progress:'
      ),
      React.createElement(ProgressBar, { value: Math.round(overallProgress) }),
      currentProgress > 0 &&
        !isComplete &&
        React.createElement(
          Box,
          { flexDirection: 'column', gap: 1, marginTop: 1 },
          React.createElement(
            Text,
            { color: 'gray', dimColor: true },
            'Current Step:'
          ),
          React.createElement(ProgressBar, {
            value: Math.round(currentProgress)
          })
        )
    )
  );
};

export default ProgressDisplay;
export { MultiStepProgress };
