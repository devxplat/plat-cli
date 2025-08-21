import React from 'react';
import { Box, Text } from 'ink';
import { UnorderedList } from '@inkjs/ui';

/**
 * Shared Migration Summary Component
 * Used by both Interactive and Classic CLI interfaces
 */
const MigrationSummary = ({ result, config, isBatch = false }) => {
  const formatDuration = (duration) => {
    if (!duration) return 'N/A';
    
    // If duration is already a string (e.g., "2m 38s"), return it
    if (typeof duration === 'string') return duration;
    
    // If duration is in milliseconds
    const totalSeconds = Math.floor(duration / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Handle batch migration summary
  if (isBatch && result.operations) {
    const successful = result.operations.filter(op => op.status === 'success');
    const failed = result.operations.filter(op => op.status === 'error');
    
    return React.createElement(
      Box,
      { flexDirection: 'column', borderStyle: 'double', borderColor: 'green', paddingX: 2, paddingY: 1 },
      React.createElement(
        Box,
        { justifyContent: 'center', marginBottom: 1 },
        React.createElement(
          Text,
          { color: 'green', bold: true },
          '✅ BATCH MIGRATION COMPLETED'
        )
      ),
      React.createElement(
        Box,
        { flexDirection: 'column', gap: 1 },
        React.createElement(
          Text,
          { color: 'cyan', bold: true },
          '📊 Batch Summary:'
        ),
        React.createElement(
          UnorderedList,
          null,
          React.createElement(
            UnorderedList.Item,
            null,
            React.createElement(
              Text,
              null,
              'Total migrations: ',
              React.createElement(Text, { color: 'white', bold: true }, result.operations.length)
            )
          ),
          successful.length > 0 && React.createElement(
            UnorderedList.Item,
            null,
            React.createElement(
              Text,
              { color: 'green' },
              `✅ Successful: ${successful.length}`
            )
          ),
          failed.length > 0 && React.createElement(
            UnorderedList.Item,
            null,
            React.createElement(
              Text,
              { color: 'red' },
              `❌ Failed: ${failed.length}`
            )
          ),
          result.totalDuration && React.createElement(
            UnorderedList.Item,
            null,
            React.createElement(
              Text,
              null,
              'Total duration: ',
              React.createElement(Text, { color: 'yellow' }, formatDuration(result.totalDuration))
            )
          )
        ),
        // Show details of each migration
        successful.length > 0 && React.createElement(
          Box,
          { flexDirection: 'column', marginTop: 1 },
          React.createElement(
            Text,
            { color: 'green', bold: true },
            'Successful Migrations:'
          ),
          ...successful.map((op, i) => 
            React.createElement(
              Text,
              { key: i, color: 'white', marginLeft: 2 },
              `→ ${op.config.source.project}:${op.config.source.instance} → ${op.config.target.project}:${op.config.target.instance}`
            )
          )
        ),
        failed.length > 0 && React.createElement(
          Box,
          { flexDirection: 'column', marginTop: 1 },
          React.createElement(
            Text,
            { color: 'red', bold: true },
            'Failed Migrations:'
          ),
          ...failed.map((op, i) => 
            React.createElement(
              Text,
              { key: i, color: 'white', marginLeft: 2 },
              `→ ${op.config.source.project}:${op.config.source.instance} → ${op.config.target.project}:${op.config.target.instance}: ${op.error}`
            )
          )
        )
      )
    );
  }

  // Single migration summary
  return React.createElement(
    Box,
    { flexDirection: 'column', borderStyle: 'double', borderColor: 'green', paddingX: 2, paddingY: 1 },
    React.createElement(
      Box,
      { justifyContent: 'center', marginBottom: 1 },
      React.createElement(
        Text,
        { color: 'green', bold: true },
        '✅ MIGRATION COMPLETED'
      )
    ),
    React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        Text,
        { color: 'cyan', bold: true },
        '📊 Migration Summary:'
      ),
      React.createElement(
        UnorderedList,
        null,
        React.createElement(
          UnorderedList.Item,
          null,
          React.createElement(
            Text,
            null,
            'Source: ',
            React.createElement(
              Text,
              { color: 'white', bold: true },
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
            'Target: ',
            React.createElement(
              Text,
              { color: 'white', bold: true },
              `${config.target.project}:${config.target.instance}`
            )
          )
        ),
        // Database information
        (() => {
          let databases = null;
          if (result.databaseDetails && result.databaseDetails.length > 0) {
            databases = result.databaseDetails.map(db => db.name);
          } else if (result.processedDatabases) {
            databases = Array.isArray(result.processedDatabases) 
              ? result.processedDatabases 
              : [result.processedDatabases];
          } else if (result.databasesToMigrate) {
            databases = result.databasesToMigrate;
          } else if (config.options?.includeAll) {
            return React.createElement(
              UnorderedList.Item,
              null,
              React.createElement(
                Text,
                null,
                'Databases: ',
                React.createElement(Text, { color: 'yellow', bold: true }, 'All available databases')
              )
            );
          } else if (config.source?.databases) {
            databases = config.source.databases;
          }
          
          if (databases && databases.length > 0) {
            return React.createElement(
              UnorderedList.Item,
              null,
              React.createElement(
                Text,
                null,
                `Database${databases.length > 1 ? 's' : ''}: `,
                React.createElement(
                  Text,
                  { color: 'yellow', bold: true },
                  `${databases.join(', ')} (${databases.length} total)`
                )
              )
            );
          }
          return null;
        })(),
        // Size information
        (result.totalSize || result.totalSizeBytes) && React.createElement(
          UnorderedList.Item,
          null,
          React.createElement(
            Text,
            null,
            'Total size: ',
            React.createElement(
              Text,
              { color: 'green', bold: true },
              result.totalSize || formatBytes(result.totalSizeBytes)
            )
          )
        ),
        // Duration
        result.duration && React.createElement(
          UnorderedList.Item,
          null,
          React.createElement(
            Text,
            null,
            'Duration: ',
            React.createElement(
              Text,
              { color: 'yellow', bold: true },
              formatDuration(result.duration)
            )
          )
        ),
        // Migration mode
        React.createElement(
          UnorderedList.Item,
          null,
          React.createElement(
            Text,
            null,
            'Mode: ',
            React.createElement(
              Text,
              { color: 'white', bold: true },
              config.options?.schemaOnly 
                ? 'Schema only' 
                : config.options?.dataOnly 
                  ? 'Data only' 
                  : 'Full migration (schema + data)'
            )
          )
        ),
        // Status message
        result.message && React.createElement(
          UnorderedList.Item,
          null,
          React.createElement(
            Text,
            null,
            'Status: ',
            React.createElement(Text, { color: 'cyan' }, result.message)
          )
        )
      )
    ),
    React.createElement(
      Box,
      { justifyContent: 'center', marginTop: 1 },
      React.createElement(
        Text,
        { color: 'green', bold: true },
        '✅ Migration completed successfully'
      )
    )
  );
};

export default MigrationSummary;