import React, { useState, useEffect, memo } from 'react';
import { Box, Text } from 'ink';
import { Select, OrderedList } from '@inkjs/ui';

/**
 * Configuration summary and confirmation component
 */
const ConfigurationSummary = ({ config, coordinator, onConfirm, onCancel }) => {
  const [estimate, setEstimate] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadEstimate = async () => {
      if (!mounted) return;

      try {
        // Only get execution estimate (connections already validated in InkApp)
        const toolName = config?.metadata?.toolName;
        let executionEstimate = null;

        if (toolName && coordinator?.getExecutionEstimate) {
          executionEstimate = await coordinator.getExecutionEstimate(
            toolName,
            config
          );
        }

        if (mounted) {
          setEstimate(executionEstimate);
        }
      } catch {
        if (mounted) {
          // If estimate fails, just continue without estimate
          setEstimate(null);
        }
      }
    };

    loadEstimate();

    return () => {
      mounted = false;
    };
  }, []);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getConfirmationMessage = () => {
    // Check if batch migration
    if (config?.isBatch && config?.mapping) {
      const summary = config.mapping.getSummary();
      if (config.mapping.options?.dryRun) {
        return `🎭 Execute dry run simulation for ${summary.totalMigrations} migrations?`;
      }
      return `⚠️ This will execute ${summary.totalMigrations} migrations. Continue?`;
    }
    
    if (config.options?.dryRun) {
      return '🎭 Execute dry run simulation?';
    }
    return '⚠️ This will migrate data between CloudSQL instances. Continue?';
  };

  // Check if batch configuration
  if (config?.isBatch && config?.mapping) {
    const summary = config.mapping.getSummary();
    
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        Text,
        { color: 'yellow', bold: true },
        '📋 Batch Migration Summary'
      ),
      React.createElement(
        OrderedList,
        null,
        React.createElement(
          OrderedList.Item,
          null,
          React.createElement(Text, { color: 'gray' }, 'Strategy: '),
          React.createElement(
            Text,
            { color: 'cyan', bold: true },
            summary.strategy
          )
        ),
        React.createElement(
          OrderedList.Item,
          null,
          React.createElement(Text, { color: 'gray' }, 'Mapping Type: '),
          React.createElement(
            Text,
            { color: 'cyan', bold: true },
            summary.mappingType
          )
        ),
        React.createElement(
          OrderedList.Item,
          null,
          React.createElement(Text, { color: 'gray' }, 'Total Sources: '),
          React.createElement(
            Text,
            { color: 'white', bold: true },
            summary.totalSources
          )
        ),
        React.createElement(
          OrderedList.Item,
          null,
          React.createElement(Text, { color: 'gray' }, 'Total Targets: '),
          React.createElement(
            Text,
            { color: 'white', bold: true },
            summary.totalTargets
          )
        ),
        React.createElement(
          OrderedList.Item,
          null,
          React.createElement(Text, { color: 'gray' }, 'Total Migrations: '),
          React.createElement(
            Text,
            { color: 'green', bold: true },
            summary.totalMigrations
          )
        ),
        React.createElement(
          OrderedList.Item,
          null,
          React.createElement(Text, { color: 'gray' }, 'Conflict Resolution: '),
          React.createElement(
            Text,
            { color: 'white', bold: true },
            summary.conflictResolution
          )
        ),
        config.mapping.options?.dryRun &&
          React.createElement(
            OrderedList.Item,
            null,
            React.createElement(
              Text,
              { color: 'magenta', bold: true },
              '⚠️ DRY RUN MODE - Simulation only'
            )
          )
      ),
      React.createElement(
        Box,
        {
          marginTop: 1,
          paddingX: 2,
          paddingY: 1,
          borderStyle: 'round',
          borderColor: 'red'
        },
        React.createElement(
          Text,
          { color: 'red', bold: true },
          getConfirmationMessage()
        )
      ),
      React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(Select, {
          options: [
            { label: '✅ Yes, proceed with migration', value: 'confirm' },
            { label: '❌ No, cancel operation', value: 'cancel' }
          ],
          defaultValue: 'cancel', // Default to cancel for safety
          onChange: (value) => {
            if (value === 'confirm') {
              onConfirm();
            } else {
              onCancel();
            }
          }
        })
      ),
      React.createElement(
        Text,
        { color: 'gray', dimColor: true, marginTop: 1 },
        '↑↓: navigate • Enter: select • Esc: back • Alt+Q: quit'
      )
    );
  }

  // Show single migration configuration summary (ready or success state)
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    React.createElement(
      Text,
      { color: 'yellow', bold: true },
      '📋 Configuration Summary'
    ),
    React.createElement(
      OrderedList,
      null,
      React.createElement(
        OrderedList.Item,
        null,
        React.createElement(Text, { color: 'gray' }, 'Source: '),
        React.createElement(
          Text,
          { color: 'cyan', bold: true },
          `${config.source.project}:${config.source.instance}`
        )
      ),
      React.createElement(
        OrderedList.Item,
        null,
        React.createElement(Text, { color: 'gray' }, 'Target: '),
        React.createElement(
          Text,
          { color: 'cyan', bold: true },
          `${config.target.project}:${config.target.instance}`
        )
      ),
      React.createElement(
        OrderedList.Item,
        null,
        React.createElement(Text, { color: 'gray' }, 'Databases: '),
        React.createElement(
          Text,
          { color: 'white', bold: true },
          config.options.includeAll
            ? 'ALL'
            : config.source.databases?.join(', ') || 'None'
        )
      ),
      React.createElement(
        OrderedList.Item,
        null,
        React.createElement(Text, { color: 'gray' }, 'Mode: '),
        React.createElement(
          Text,
          { color: 'white', bold: true },
          config.options.schemaOnly
            ? 'Schema only'
            : config.options.dataOnly
              ? 'Data only'
              : 'Full migration'
        )
      ),
      config.options.dryRun &&
        React.createElement(
          OrderedList.Item,
          null,
          React.createElement(
            Text,
            { color: 'magenta', bold: true },
            '⚠️ DRY RUN MODE - Simulation only'
          )
        ),
      estimate &&
        React.createElement(
          OrderedList.Item,
          null,
          React.createElement(Text, { color: 'gray' }, 'Estimate: '),
          React.createElement(
            Text,
            { color: 'green', bold: true },
            `${formatBytes(estimate.totalSizeBytes)} (~${Math.round(estimate.estimatedDurationMinutes)} min)`
          )
        )
    ),
    React.createElement(
      Box,
      {
        marginTop: 1,
        paddingX: 2,
        paddingY: 1,
        borderStyle: 'round',
        borderColor: 'red'
      },
      React.createElement(
        Text,
        { color: 'red', bold: true },
        getConfirmationMessage()
      )
    ),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Select, {
        options: [
          { label: '✅ Yes, proceed with migration', value: 'confirm' },
          { label: '❌ No, cancel operation', value: 'cancel' }
        ],
        defaultValue: 'cancel', // Default to cancel for safety
        onChange: (value) => {
          if (value === 'confirm') {
            onConfirm();
          } else {
            onCancel();
          }
        }
      })
    ),
    React.createElement(
      Text,
      { color: 'gray', dimColor: true, marginTop: 1 },
      '↑↓: navigate • Enter: select • Esc: back • Alt+Q: quit'
    )
  );
};

// Memoize component to prevent unnecessary re-renders
export default memo(ConfigurationSummary);
