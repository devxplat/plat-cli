import React from 'react';
import { Box, Text } from 'ink';
import { ProgressBar, Spinner } from '@inkjs/ui';
import CustomSpinner, { FlowSpinner } from './CustomSpinner.js';
import CustomProgressBar from './CustomProgressBar.js';
import { colorPalettes } from '../theme/custom-theme.js';

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
        return colorPalettes.matchingGradient[4]; // Green-ish from matching gradient
      case 'error':
        return colorPalettes.classyPalette[4]; // Red from classy palette
      case 'warning':
        return colorPalettes.genericGradient[3]; // Orange from generic gradient
      default:
        return colorPalettes.matchingGradient[2]; // Blue from matching gradient
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
        ? React.createElement(CustomSpinner, { 
            label: message, 
            isVisible: true,
            status: 'running',
            compact: true 
          })
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
        ? React.createElement(FlowSpinner, { 
            label: message, 
            isVisible: true,
            status: 'running'
          })
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
        React.createElement(CustomProgressBar, { 
          value: Math.round(progress),
          width: 25,
          showPercentage: false,
          style: 'gradient'
        }),
        React.createElement(
          Text,
          { color: colorPalettes.spotPalette[1], dimColor: true },
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
      { bold: true, color: colorPalettes.genericGradient[0] },
      `Step ${Math.min(currentStep + 1, steps.length)}/${steps.length}: ${currentStepName}`
    ),
    React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.spotPalette[1], dimColor: true },
        'Overall Progress:'
      ),
      React.createElement(CustomProgressBar, { 
        value: Math.round(overallProgress),
        width: 30,
        showPercentage: true,
        style: 'segments'
      }),
      currentProgress > 0 &&
        !isComplete &&
        React.createElement(
          Box,
          { flexDirection: 'column', gap: 1, marginTop: 1 },
          React.createElement(
            Text,
            { color: colorPalettes.spotPalette[1], dimColor: true },
            'Current Step:'
          ),
          React.createElement(CustomProgressBar, {
            value: Math.round(currentProgress),
            width: 25,
            showPercentage: true,
            style: 'bar'
          })
        )
    )
  );
};

export default ProgressDisplay;
export { MultiStepProgress };
