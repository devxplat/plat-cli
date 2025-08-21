import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { StatusMessage } from '@inkjs/ui';
import { ShimmerSpinner } from './CustomSpinner.js';
import TodoList from './TodoList.js';

/**
 * Migration Progress Component
 * Displays real-time migration progress using Ink UI components
 */
const MigrationProgress = ({ phase, status, isComplete, error, summary, tasks = [] }) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());
  const [migrationTasks, setMigrationTasks] = useState([]);

  useEffect(() => {
    if (!isComplete && !error) {
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isComplete, error, startTime]);
  
  useEffect(() => {
    // Initialize or update migration tasks
    if (tasks && tasks.length > 0) {
      setMigrationTasks(tasks);
    } else if (phase) {
      // Create default tasks based on phase
      const defaultTasks = [
        { id: 'validate', label: 'Validation', status: 'completed' },
        { id: 'export', label: 'Export databases', status: phase === 'Export' ? 'in_progress' : 'pending' },
        { id: 'import', label: 'Import databases', status: phase === 'Import' ? 'in_progress' : (phase === 'Export' ? 'pending' : 'completed') },
        { id: 'verify', label: 'Post-migration validation', status: isComplete ? 'completed' : 'pending' }
      ];
      setMigrationTasks(defaultTasks);
    }
  }, [phase, tasks, isComplete]);

  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDuration = (milliseconds) => {
    if (typeof milliseconds === 'string') {
      return milliseconds; // Already formatted
    }
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
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
        (summary.databaseDetails && summary.databaseDetails.length > 0) ? React.createElement(
          Text,
          null,
          `Database${summary.databaseDetails.length === 1 ? '' : 's'} migrated: ${summary.databaseDetails.map(db => db.name).join(', ')}`
        ) : summary.processedDatabases && React.createElement(
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
          `Duration: ${formatDuration(summary.duration)}`
        )
      )
    );
  }

  // Show active progress with TODO list and spinner
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    // Show TODO list timeline
    migrationTasks.length > 0 && React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(TodoList, {
        tasks: migrationTasks,
        title: 'Migration Steps',
        showTimeline: false,
        maxVisible: 6
      })
    ),
    // Show spinner at the bottom
    React.createElement(
      Box,
      { gap: 2, marginTop: 1 },
      React.createElement(ShimmerSpinner, {
        label: `${phase || 'Initializing'}...`,
        isVisible: true,
        status: 'running'
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