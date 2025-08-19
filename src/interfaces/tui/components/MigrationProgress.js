import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Spinner, StatusMessage } from '@inkjs/ui';

/**
 * Migration Progress Component
 * Displays real-time migration progress using Ink UI components
 */
const MigrationProgress = ({ phase, status, isComplete, error, summary }) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (!isComplete && !error) {
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isComplete, error, startTime]);

  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Show error state
  if (error) {
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(StatusMessage, {
        variant: 'error',
        children: `Migration failed: ${error.message || error}`
      })
    );
  }

  // Show completion state
  if (isComplete) {
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(StatusMessage, {
        variant: 'success',
        children: 'Migration completed successfully'
      }),
      summary && React.createElement(
        Box,
        { flexDirection: 'column', marginLeft: 2 },
        summary.processedDatabases && React.createElement(
          Text,
          null,
          `Databases migrated: ${summary.processedDatabases}`
        ),
        summary.totalSize && React.createElement(
          Text,
          null,
          `Total size: ${summary.totalSize}`
        ),
        summary.duration && React.createElement(
          Text,
          null,
          `Duration: ${summary.duration}`
        )
      )
    );
  }

  // Show active progress with spinner
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    React.createElement(
      Box,
      { gap: 2 },
      React.createElement(Spinner, {
        label: `${phase || 'Initializing'}...`
      }),
      React.createElement(
        Text,
        { dimColor: true },
        `(${formatTime(elapsedTime)})`
      )
    ),
    status && React.createElement(
      Box,
      { marginLeft: 4 },
      React.createElement(
        Text,
        { dimColor: true },
        status
      )
    )
  );
};

export default MigrationProgress;