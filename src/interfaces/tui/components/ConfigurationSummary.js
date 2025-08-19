import React, { useState, useEffect, memo } from 'react';
import { Box, Text } from 'ink';
import { Alert, UnorderedList } from '@inkjs/ui';
import { colorPalettes } from '../theme/custom-theme.js';
import SimpleSelect from './SimpleSelect.js';

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

  const renderMigrationAlert = () => {
    const isDryRun = config?.isBatch ? config.mapping?.options?.dryRun : config?.options?.dryRun;
    const isBatch = config?.isBatch && config?.mapping;
    
    let message;
    if (isBatch) {
      const summary = config.mapping.getSummary();
      message = isDryRun 
        ? `🎭 DRY RUN: Simulate ${summary.totalMigrations} migrations`
        : `⚠️ LIVE: Execute ${summary.totalMigrations} migrations`;
    } else {
      message = isDryRun
        ? '🎭 DRY RUN: Simulation only, no data will be migrated'
        : '⚠️ LIVE MIGRATION: Data will be transferred between instances';
    }
    
    return React.createElement(
      Box,
      { marginTop: 1, marginBottom: 1 },
      React.createElement(Alert, {
        variant: isDryRun ? 'info' : 'error',
        title: message
      })
    );
  };

  // Check if batch configuration
  if (config?.isBatch && config?.mapping) {
    const summary = config.mapping.getSummary();
    
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.dust.primary, bold: true },
        '📋 Batch Migration Summary'
      ),
      React.createElement(
        UnorderedList,
        { marginTop: 1 },
        React.createElement(
          UnorderedList.Item,
          null,
          React.createElement(
            Text,
            null,
            React.createElement(Text, { color: colorPalettes.dust.tertiary }, 'Strategy: '),
            React.createElement(Text, { color: colorPalettes.dust.primary, bold: true }, summary.strategy),
            React.createElement(Text, { color: colorPalettes.dust.tertiary }, ' | Type: '),
            React.createElement(Text, { color: colorPalettes.dust.primary, bold: true }, summary.mappingType)
          )
        ),
        React.createElement(
          UnorderedList.Item,
          null,
          React.createElement(
            Text,
            null,
            React.createElement(Text, { color: colorPalettes.dust.tertiary }, 'Sources: '),
            React.createElement(Text, { color: 'white', bold: true }, summary.totalSources),
            React.createElement(Text, { color: colorPalettes.dust.tertiary }, ' → Targets: '),
            React.createElement(Text, { color: 'white', bold: true }, summary.totalTargets),
            React.createElement(Text, { color: colorPalettes.dust.tertiary }, ' = '),
            React.createElement(Text, { color: 'green', bold: true }, `${summary.totalMigrations} migrations`)
          )
        ),
        React.createElement(
          UnorderedList.Item,
          null,
          React.createElement(
            Text,
            null,
            React.createElement(Text, { color: colorPalettes.dust.tertiary }, 'Conflicts: '),
            React.createElement(Text, { color: 'white', bold: true }, summary.conflictResolution)
          )
        )
      ),
      renderMigrationAlert(),
      React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(SimpleSelect, {
          options: [
            { label: '✅ Yes, proceed with migration', value: 'confirm' },
            { label: '❌ No, cancel operation', value: 'cancel' }
          ],
          defaultValue: 'cancel', // Default to cancel for safety
          onSubmit: (value) => {
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
        { color: '#ac8500', marginTop: 1 },
        '↑↓: navigate • Enter: select • Esc: back • Ctrl+X: quit'
      )
    );
  }

  // Show single migration configuration summary (ready or success state)
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    React.createElement(
      Text,
      { color: colorPalettes.dust.primary, bold: true },
      '📋 Migration Summary'
    ),
    React.createElement(
      UnorderedList,
      { marginTop: 1 },
      React.createElement(
        UnorderedList.Item,
        null,
        React.createElement(
          Text,
          null,
          React.createElement(Text, { color: colorPalettes.dust.tertiary }, 'From: '),
          React.createElement(Text, { color: colorPalettes.dust.primary, bold: true }, 
            `${config.source.project}:${config.source.instance}`
          )
        )
      ),
      React.createElement(
        UnorderedList.Item,
        null,
        React.createElement(
          Text,
          null,
          React.createElement(Text, { color: colorPalettes.dust.tertiary }, 'To: '),
          React.createElement(Text, { color: colorPalettes.dust.primary, bold: true }, 
            `${config.target.project}:${config.target.instance}`
          )
        )
      ),
      React.createElement(
        UnorderedList.Item,
        null,
        React.createElement(
          Text,
          null,
          React.createElement(Text, { color: colorPalettes.dust.tertiary }, 'DBs: '),
          React.createElement(Text, { color: 'white', bold: true }, 
            config.options.includeAll
              ? 'ALL'
              : config.source.databases?.join(', ') || 'None'
          ),
          React.createElement(Text, { color: colorPalettes.dust.tertiary }, ' | Mode: '),
          React.createElement(Text, { color: 'white', bold: true },
            config.options.schemaOnly
              ? 'Schema'
              : config.options.dataOnly
                ? 'Data'
                : 'Full'
          ),
          estimate && React.createElement(React.Fragment, null,
            React.createElement(Text, { color: colorPalettes.dust.tertiary }, ' | Size: '),
            React.createElement(Text, { color: 'green', bold: true },
              `${formatBytes(estimate.totalSizeBytes)} (~${Math.round(estimate.estimatedDurationMinutes)}min)`
            )
          )
        )
      )
    ),
    renderMigrationAlert(),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(SimpleSelect, {
        options: [
          { label: '✅ Yes, proceed with migration', value: 'confirm' },
          { label: '❌ No, cancel operation', value: 'cancel' }
        ],
        defaultValue: 'cancel', // Default to cancel for safety
        onSubmit: (value) => {
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
      { color: '#ac8500', marginTop: 1 },
      '↑↓: navigate • Enter: select • Esc: back • Ctrl+X: quit'
    )
  );
};

// Memoize component to prevent unnecessary re-renders
export default memo(ConfigurationSummary);
