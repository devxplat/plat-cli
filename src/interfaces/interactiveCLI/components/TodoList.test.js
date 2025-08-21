import React from 'react';
import test from 'ava';
import { render } from 'ink-testing-library';
import TodoList from './TodoList.js';

test('TodoList renders tasks correctly', t => {
  const tasks = [
    { id: '1', label: 'Validation', status: 'completed', completedAt: Date.now() - 5000 },
    { id: '2', label: 'Export databases', status: 'in_progress', startedAt: Date.now() - 2000 },
    { id: '3', label: 'Import databases', status: 'pending' }
  ];

  const { lastFrame } = render(
    React.createElement(TodoList, { tasks })
  );

  const output = lastFrame();
  
  // Check that completed task has checkmark
  t.regex(output, /✓.*Validation/);
  
  // Check that in-progress task has circle
  t.regex(output, /◎.*Export databases/);
  
  // Check that pending task has empty circle
  t.regex(output, /○.*Import databases/);
});

test('TodoList respects maxVisible prop', t => {
  const tasks = Array.from({ length: 10 }, (_, i) => ({
    id: `task-${i}`,
    label: `Task ${i + 1}`,
    status: 'pending'
  }));

  const { lastFrame } = render(
    React.createElement(TodoList, { tasks, maxVisible: 3 })
  );

  const output = lastFrame();
  
  // Should show first 3 tasks
  t.regex(output, /Task 1/);
  t.regex(output, /Task 2/);
  t.regex(output, /Task 3/);
  
  // Should show remaining count
  t.regex(output, /and 7 more/);
});

test('TodoList shows timeline mode correctly', t => {
  const tasks = [
    { id: '1', label: 'Step 1', status: 'completed', completedAt: Date.now() - 10000 },
    { id: '2', label: 'Step 2', status: 'completed', completedAt: Date.now() - 8000 },
    { id: '3', label: 'Step 3', status: 'completed', completedAt: Date.now() - 6000 },
    { id: '4', label: 'Step 4', status: 'completed', completedAt: Date.now() - 4000 },
    { id: '5', label: 'Step 5', status: 'in_progress', startedAt: Date.now() - 2000 },
    { id: '6', label: 'Step 6', status: 'pending' }
  ];

  const { lastFrame } = render(
    React.createElement(TodoList, { 
      tasks, 
      showTimeline: true,
      maxVisible: 5 
    })
  );

  const output = lastFrame();
  
  // In timeline mode, should show recent completed and active tasks
  t.regex(output, /Step 5/); // in progress
  t.regex(output, /Step 6/); // pending
  
  // Should show some completed tasks
  t.truthy(output.includes('✓'));
});