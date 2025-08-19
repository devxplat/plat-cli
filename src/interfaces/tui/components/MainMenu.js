import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Select, StatusMessage } from '@inkjs/ui';

/**
 * Main menu component using Ink UI Select for single-line interface
 */
const MainMenu = ({ coordinator, onToolSelected, onExit }) => {
  const [availableTools, setAvailableTools] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const tools = coordinator.getAvailableTools();
      setAvailableTools(tools);
    } catch (err) {
      setError(`Failed to load tools: ${err.message}`);
    }
  }, [coordinator]);

  const handleSelection = (value) => {
    if (value === 'exit') {
      onExit();
    } else {
      onToolSelected(value);
    }
  };

  if (error) {
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(StatusMessage, { variant: 'error' }, error)
    );
  }

  if (availableTools.length === 0) {
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        StatusMessage,
        { variant: 'info' },
        'Loading available tools...'
      )
    );
  }

  const options = [
    ...availableTools.map((tool) => ({
      label: `${tool.metadata.description}`,
      value: tool.name
    })),
    { label: 'Exit', value: 'exit' }
  ];

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    React.createElement(
      Text,
      { color: 'cyan' },
      '🚀 Platform DevEx CLI - Select tool:'
    ),
    React.createElement(Select, {
      options: options,
      onChange: handleSelection,
      visibleOptionCount: 6
    }),
    React.createElement(
      Text,
      { color: 'gray', dimColor: true },
      'Use arrow keys to navigate • Enter: select • Alt+Q: quit'
    )
  );
};

export default MainMenu;
