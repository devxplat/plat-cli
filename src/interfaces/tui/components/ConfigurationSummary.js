import React, { useState, useEffect, memo } from 'react';
import { Box, Text } from 'ink';
import { UnorderedList } from '@inkjs/ui';
import { colorPalettes } from '../theme/custom-theme.js';
import SimpleSelect from './SimpleSelect.js';
import CustomAlert from './CustomAlert.js';

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
        : `🚀 LIVE: Execute ${summary.totalMigrations} migrations`;
    } else {
      message = isDryRun
        ? '🎭 DRY RUN: Simulation only, no data will be migrated'
        : '🚀 LIVE MIGRATION: Data will be transferred between instances';
    }
    
    return React.createElement(
      Box,
      { marginTop: 1, marginBottom: 1 },
      React.createElement(CustomAlert, {
        variant: isDryRun ? 'info' : 'warning',
        title: message
      })
    );
  };

  // Check if batch configuration
  if (config?.isBatch && config?.mapping) {
    const summary = config.mapping.getSummary();
    const isInteractive = config?.metadata?.mode === 'interactive';
    
    // Get detailed source and target information for interactive mode
    const sources = config.mapping.sources || [];
    const targets = config.mapping.targets || [];
    
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
        ),
        // Show source instances for interactive mode
        isInteractive && sources.length > 0 && React.createElement(
          UnorderedList.Item,
          null,
          React.createElement(
            Box,
            { flexDirection: 'column' },
            React.createElement(
              Text,
              { color: colorPalettes.dust.secondary },
              `Source instances (${sources.length}):`
            ),
            ...sources.slice(0, 3).map((src, i) => 
              React.createElement(
                Text,
                { key: i, color: 'cyan', marginLeft: 2 },
                `→ ${src.project}:${src.instance}${src.databases?.length ? ` (${src.databases.length} DBs)` : ''}`
              )
            ),
            sources.length > 3 && React.createElement(
              Text,
              { color: colorPalettes.dust.tertiary, marginLeft: 2 },
              `  ... and ${sources.length - 3} more`
            )
          )
        ),
        // Show target instances for interactive mode
        isInteractive && targets.length > 0 && React.createElement(
          UnorderedList.Item,
          null,
          React.createElement(
            Box,
            { flexDirection: 'column' },
            React.createElement(
              Text,
              { color: colorPalettes.dust.secondary },
              `Target instances (${targets.length}):`
            ),
            ...targets.slice(0, 3).map((tgt, i) => 
              React.createElement(
                Text,
                { key: i, color: 'green', marginLeft: 2 },
                `→ ${tgt.project}:${tgt.instance}`
              )
            ),
            targets.length > 3 && React.createElement(
              Text,
              { color: colorPalettes.dust.tertiary, marginLeft: 2 },
              `  ... and ${targets.length - 3} more`
            )
          )
        ),
        // Show total databases count
        isInteractive && React.createElement(
          UnorderedList.Item,
          null,
          React.createElement(
            Text,
            null,
            React.createElement(Text, { color: colorPalettes.dust.tertiary }, 'Total databases: '),
            React.createElement(Text, { color: 'yellow', bold: true }, 
              sources.reduce((sum, src) => sum + (src.databases?.length || 0), 0)
            )
          )
        ),
        // Show password configuration mode
        isInteractive && config.mapping.sources[0]?.password && React.createElement(
          UnorderedList.Item,
          null,
          React.createElement(
            Text,
            null,
            React.createElement(Text, { color: colorPalettes.dust.tertiary }, 'Password mode: '),
            React.createElement(Text, { color: 'white', bold: true }, 
              config.mapping.sources.every(s => s.password === config.mapping.sources[0].password) 
                ? 'Single password' 
                : 'Multiple passwords'
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
    )
  );
};

// Memoize component to prevent unnecessary re-renders
export default memo(ConfigurationSummary);
