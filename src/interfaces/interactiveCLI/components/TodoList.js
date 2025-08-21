import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { colorPalettes } from '../theme/custom-theme.js';

/**
 * TodoList Component - Shows a dynamic task list with checkboxes
 * Used for tracking migration progress with real-time updates
 */
const TodoList = ({ tasks = [], title = 'Migration Progress', showTimeline = true, maxVisible = 10 }) => {
  const [visibleTasks, setVisibleTasks] = useState([]);
  
  useEffect(() => {
    // Show most recent completed tasks and all pending/in-progress tasks
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const activeTasks = tasks.filter(t => t.status !== 'completed');
    
    let tasksToShow = [];
    
    if (showTimeline) {
      // Timeline mode: show recent completed + active tasks
      const recentCompleted = completedTasks.slice(-Math.max(3, maxVisible - activeTasks.length - 2));
      tasksToShow = [...recentCompleted, ...activeTasks];
    } else {
      // Checklist mode: show all tasks up to maxVisible
      tasksToShow = tasks.slice(0, maxVisible);
    }
    
    setVisibleTasks(tasksToShow);
  }, [tasks, showTimeline, maxVisible]);
  
  const getTaskIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in_progress':
        return '◎';
      case 'error':
        return '✗';
      case 'pending':
      default:
        return '○';
    }
  };
  
  const getTaskColor = (status) => {
    switch (status) {
      case 'completed':
        return colorPalettes.genericGradient[2]; // Green
      case 'in_progress':
        return colorPalettes.genericGradient[1]; // Yellow
      case 'error':
        return colorPalettes.classyPalette[4]; // Red
      case 'pending':
      default:
        return colorPalettes.dust.tertiary; // Gray
    }
  };
  
  const formatTaskTime = (task) => {
    if (!task.completedAt && !task.startedAt) return '';
    
    if (task.completedAt && task.startedAt) {
      const duration = task.completedAt - task.startedAt;
      const seconds = Math.floor(duration / 1000);
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m ${seconds % 60}s`;
    }
    
    if (task.startedAt && task.status === 'in_progress') {
      const elapsed = Date.now() - task.startedAt;
      const seconds = Math.floor(elapsed / 1000);
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m ${seconds % 60}s`;
    }
    
    return '';
  };
  
  if (!visibleTasks || visibleTasks.length === 0) {
    return null;
  }
  
  return React.createElement(
    Box,
    { flexDirection: 'column' },
    title && React.createElement(
      Text,
      { bold: true, color: colorPalettes.dust.primary },
      title
    ),
    title && React.createElement(Box, { height: 1 }),
    React.createElement(
      Box,
      { flexDirection: 'column' },
      ...visibleTasks.map((task, index) => {
      const isActive = task.status === 'in_progress';
      const icon = getTaskIcon(task.status);
      const color = getTaskColor(task.status);
      const timeStr = formatTaskTime(task);
      
      return React.createElement(
        Box,
        { 
          key: task.id || index,
          gap: 1,
          marginLeft: 1
        },
        React.createElement(
          Text,
          { color: color },
          icon
        ),
        React.createElement(
          Box,
          { flexGrow: 1, flexDirection: 'row', justifyContent: 'space-between' },
          React.createElement(
            Text,
            { 
              color: isActive ? colorPalettes.dust.primary : color,
              bold: isActive,
              dimColor: task.status === 'completed'
            },
            task.label || task.name
          ),
          timeStr && React.createElement(
            Text,
            { 
              color: colorPalettes.dust.tertiary,
              dimColor: true
            },
            timeStr
          )
        ),
        task.details && task.status === 'in_progress' && React.createElement(
          Text,
          { 
            color: colorPalettes.dust.secondary,
            dimColor: true
          },
          ` ${task.details}`
        )
      );
      })
    ),
    // Show remaining count if there are more tasks
    tasks.length > visibleTasks.length && React.createElement(
      Box,
      { marginTop: 1, marginLeft: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.dust.tertiary, dimColor: true },
        `... and ${tasks.length - visibleTasks.length} more`
      )
    )
  );
};

export default TodoList;