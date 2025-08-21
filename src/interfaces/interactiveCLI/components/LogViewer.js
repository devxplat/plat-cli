import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { StatusMessage } from '@inkjs/ui';

/**
 * Format duration from milliseconds to HH:MM:SS
 */
const formatDuration = (milliseconds) => {
  if (!milliseconds || isNaN(milliseconds)) return '00:00:00';
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return [hours, minutes, seconds]
    .map(val => val.toString().padStart(2, '0'))
    .join(':');
};

/**
 * LogViewer Component
 * Displays detailed migration logs with navigation
 */
const LogViewer = ({ result, onBack }) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const maxLines = 20; // Number of lines to show at once
  
  // Format the result into readable log lines
  const formatLogs = () => {
    const lines = [];
    
    // Check if we have any result data
    if (!result) {
      lines.push('No migration data available');
      return lines;
    }
    
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('📋 DETAILED MIGRATION LOGS');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    
    // Migration ID and basic info
    if (result.migrationId) {
      lines.push(`Migration ID: ${result.migrationId}`);
    }
    
    // Instance information
    if (result.sourceInstance) {
      lines.push(`Source Instance: ${result.sourceInstance}`);
    }
    if (result.targetInstance) {
      lines.push(`Target Instance: ${result.targetInstance}`);
    }
    lines.push('');
    
    // Timing information
    lines.push('⏱️ TIMING INFORMATION:');
    lines.push('───────────────────────');
    if (result.startTime) {
      lines.push(`Started at: ${result.startTime}`);
    }
    if (result.endTime) {
      lines.push(`Ended at: ${result.endTime}`);
    }
    if (result.duration) {
      // Duration can be a formatted string or milliseconds
      const durationDisplay = typeof result.duration === 'number' 
        ? formatDuration(result.duration) 
        : result.duration;
      lines.push(`Total Duration: ${durationDisplay}`);
    } else if (result.durationSeconds) {
      lines.push(`Total Duration: ${formatDuration(result.durationSeconds * 1000)}`);
    }
    lines.push('');
    
    // Database details
    if (result.databases && result.databases.length > 0) {
      lines.push('📦 DATABASES MIGRATED:');
      lines.push('─────────────────────');
      result.databases.forEach((db, index) => {
        lines.push(`  ${index + 1}. ${db}`);
      });
      lines.push('');
    }
    
    // Detailed database information
    if (result.databaseDetails && result.databaseDetails.length > 0) {
      lines.push('📊 DETAILED DATABASE INFORMATION:');
      lines.push('─────────────────────────────────');
      result.databaseDetails.forEach(detail => {
        lines.push(`  Database: ${detail.name || 'Unknown'}`);
        if (detail.sizeBytes) {
          const sizeMB = (detail.sizeBytes / (1024 * 1024)).toFixed(2);
          lines.push(`    Size: ${sizeMB} MB`);
        }
        if (detail.tables) {
          lines.push(`    Tables: ${detail.tables}`);
        }
        if (detail.status) {
          lines.push(`    Status: ${detail.status}`);
        }
        lines.push('');
      });
    }
    
    // Metrics
    if (result.metrics) {
      lines.push('📈 MIGRATION METRICS:');
      lines.push('────────────────────');
      if (result.metrics.totalDatabases) {
        lines.push(`  Total Databases: ${result.metrics.totalDatabases}`);
      }
      if (result.metrics.processedDatabases !== undefined) {
        lines.push(`  Processed Databases: ${result.metrics.processedDatabases}`);
      }
      if (result.metrics.processedSizeBytes) {
        const sizeMB = (result.metrics.processedSizeBytes / (1024 * 1024)).toFixed(2);
        lines.push(`  Total Data Processed: ${sizeMB} MB`);
      } else if (result.metrics.totalSizeBytes) {
        const sizeMB = (result.metrics.totalSizeBytes / (1024 * 1024)).toFixed(2);
        lines.push(`  Total Data Size: ${sizeMB} MB`);
      }
      if (result.totalSize) {
        lines.push(`  Total Size: ${result.totalSize}`);
      }
      if (result.metrics.exportDuration) {
        const exportTime = formatDuration(result.metrics.exportDuration);
        lines.push(`  Export Duration: ${exportTime}`);
      }
      if (result.metrics.importDuration) {
        const importTime = formatDuration(result.metrics.importDuration);
        lines.push(`  Import Duration: ${importTime}`);
      }
      lines.push('');
    }
    
    // Successful operations
    if (result.successful && result.successful.length > 0) {
      lines.push('✅ SUCCESSFUL OPERATIONS:');
      lines.push('────────────────────────');
      result.successful.forEach((op, index) => {
        lines.push(`  ${index + 1}. ${op}`);
      });
      lines.push('');
    }
    
    // Failed operations
    if (result.failed && result.failed.length > 0) {
      lines.push('❌ FAILED OPERATIONS:');
      lines.push('───────────────────');
      result.failed.forEach(failure => {
        lines.push(`  Database: ${failure.database || 'Unknown'}`);
        lines.push(`    Error: ${failure.error || 'Unknown error'}`);
        lines.push('');
      });
    }
    
    // Raw result for debugging
    if (process.env.DEBUG) {
      lines.push('🔍 RAW RESULT (DEBUG MODE):');
      lines.push('──────────────────────────');
      lines.push(JSON.stringify(result, null, 2));
      lines.push('');
    }
    
    lines.push('═══════════════════════════════════════════════════════════════');
    
    return lines;
  };
  
  const logLines = formatLogs();
  const totalLines = logLines.length;
  const visibleLines = logLines.slice(scrollOffset, scrollOffset + maxLines);
  
  // Handle keyboard navigation
  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onBack();
    }
    
    if (key.upArrow) {
      setScrollOffset(Math.max(0, scrollOffset - 1));
    }
    
    if (key.downArrow) {
      setScrollOffset(Math.min(totalLines - maxLines, scrollOffset + 1));
    }
    
    if (key.pageUp) {
      setScrollOffset(Math.max(0, scrollOffset - maxLines));
    }
    
    if (key.pageDown) {
      setScrollOffset(Math.min(totalLines - maxLines, scrollOffset + maxLines));
    }
    
    if (input === 'q') {
      onBack();
    }
  });
  
  const showScrollIndicator = totalLines > maxLines;
  const scrollPercentage = totalLines > maxLines 
    ? Math.round((scrollOffset / (totalLines - maxLines)) * 100)
    : 100;
  
  return React.createElement(
    Box,
    { flexDirection: 'column' },
    // Header
    React.createElement(
      Box,
      { marginBottom: 1 },
      React.createElement(
        Text,
        { bold: true, color: 'cyan' },
        '📋 Migration Logs Viewer'
      ),
      showScrollIndicator && React.createElement(
        Text,
        { color: 'gray' },
        ` (${scrollPercentage}%)`
      )
    ),
    
    // Log content
    React.createElement(
      Box,
      { flexDirection: 'column', borderStyle: 'single', padding: 1 },
      ...visibleLines.map((line, index) => 
        React.createElement(
          Text,
          { key: index },
          line
        )
      )
    ),
    
    // Navigation hints
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(
        Text,
        { color: 'gray' },
        showScrollIndicator 
          ? '↑↓: Scroll • PgUp/PgDn: Page • ESC/Q: Back'
          : 'ESC/Q: Back to summary'
      )
    )
  );
};

export default LogViewer;