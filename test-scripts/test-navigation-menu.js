#!/usr/bin/env node

import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import NavigationMenu from '../src/interfaces/interactiveCLI/components/NavigationMenu.js';

const TestNavigationApp = () => {
  const [path, setPath] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    setLogs((prev) => [...prev, message]);
  };

  const handleNavigate = (newPath) => {
    addLog(`Navigate to: ${JSON.stringify(newPath)}`);
    setPath(newPath);
  };

  const handleToolSelected = (toolName) => {
    addLog(`Tool selected: ${toolName}`);
    setSelectedTool(toolName);
  };

  const handleBack = () => {
    addLog('Back pressed');
    if (path.length > 0) {
      const newPath = path.slice(0, -1);
      setPath(newPath);
    }
  };

  const handleExit = () => {
    addLog('Exit requested');
    process.exit(0);
  };

  if (selectedTool) {
    return React.createElement(
      Box,
      { flexDirection: 'column' },
      React.createElement(
        Text,
        { color: 'green' },
        `✅ Tool selected: ${selectedTool}`
      ),
      React.createElement(Text, { color: 'yellow' }, 'Press Ctrl+C to exit')
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    React.createElement(NavigationMenu, {
      path: path,
      onNavigate: handleNavigate,
      onSelectTool: handleToolSelected,
      onBack: handleBack,
      onExit: handleExit
    }),
    React.createElement(Text, null, ''),
    React.createElement(Text, { color: 'gray' }, '--- Debug Logs ---'),
    ...logs.map((log, i) =>
      React.createElement(Text, { key: i, color: 'cyan' }, log)
    )
  );
};

console.log('Testing Navigation Menu');
console.log('======================');
console.log('');
console.log('Expected flow:');
console.log('1. Select "Google Cloud Platform"');
console.log('2. Select "CloudSQL / Migrate"');
console.log('3. Should trigger tool selection');
console.log('');

const app = render(React.createElement(TestNavigationApp));
