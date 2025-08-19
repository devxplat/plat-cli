import React from 'react';
import { Box, Text } from 'ink';
import { Badge, StatusMessage } from '@inkjs/ui';
import { colorPalettes } from '../theme/custom-theme.js';

/**
 * MigrationPatternDetector Component
 * Analyzes source and target selections to determine migration pattern
 */
const MigrationPatternDetector = ({ 
  sourceInstances = [],
  targetInstances = [],
  onPatternDetected,
  showDetails = true
}) => {
  // Analyze migration pattern
  const analyzePattern = () => {
    const sourceCount = sourceInstances.length;
    const targetCount = targetInstances.length;

    let pattern = '1:1';
    let strategy = 'simple';
    let description = '';
    let warnings = [];
    let recommendations = [];

    // Determine pattern type
    if (sourceCount === 1 && targetCount === 1) {
      pattern = '1:1';
      strategy = 'simple';
      description = 'Simple one-to-one migration';
    } else if (sourceCount > 1 && targetCount === 1) {
      pattern = 'N:1';
      strategy = 'consolidate';
      description = 'Consolidation migration (multiple sources to single target)';
      
      // Check for database name conflicts
      const allDatabases = sourceInstances.flatMap(inst => inst.databases || []);
      const uniqueDatabases = new Set(allDatabases);
      if (allDatabases.length !== uniqueDatabases.size) {
        warnings.push('Database name conflicts detected. Configure conflict resolution strategy.');
      }
      
      recommendations.push('Consider using database name prefixes to avoid conflicts');
    } else if (sourceCount === targetCount) {
      pattern = 'N:N';
      strategy = 'version-based';
      description = 'Parallel migration (matching source and target counts)';
      
      // Check version compatibility
      const sourceVersions = new Set(sourceInstances.map(i => i.version));
      const targetVersions = new Set(targetInstances.map(i => i.version));
      
      if (sourceVersions.size === 1 && targetVersions.size === 1) {
        const sourceVer = [...sourceVersions][0];
        const targetVer = [...targetVersions][0];
        
        if (sourceVer === targetVer) {
          recommendations.push(`All instances using PostgreSQL ${sourceVer} - perfect compatibility`);
        } else if (parseInt(targetVer) > parseInt(sourceVer)) {
          recommendations.push(`Upgrading from PG ${sourceVer} to ${targetVer}`);
        } else {
          warnings.push(`Downgrading from PG ${sourceVer} to ${targetVer} may cause issues`);
        }
      } else {
        recommendations.push('Mixed versions detected - will map by version compatibility');
      }
    } else if (sourceCount === 1 && targetCount > 1) {
      pattern = '1:N';
      strategy = 'distribute';
      description = 'Distribution migration (single source to multiple targets)';
      recommendations.push('Consider how to split databases across targets');
    } else {
      pattern = 'N:M';
      strategy = 'custom';
      description = 'Custom migration pattern';
      warnings.push('Complex migration pattern - manual mapping may be required');
    }

    // Check cross-region migrations
    const sourceRegions = new Set(sourceInstances.map(i => i.region));
    const targetRegions = new Set(targetInstances.map(i => i.region));
    const crossRegion = [...sourceRegions].some(sr => ![...targetRegions].includes(sr));
    
    if (crossRegion) {
      warnings.push('Cross-region migration detected - may increase transfer time');
    }

    // Calculate total databases to migrate
    const totalDatabases = sourceInstances.reduce((sum, inst) => 
      sum + (inst.databases?.length || 0), 0
    );

    // Calculate total disk size
    const totalDiskSize = sourceInstances.reduce((sum, inst) => 
      sum + (inst.diskSize || 0), 0
    );

    return {
      pattern,
      strategy,
      description,
      sourceCount,
      targetCount,
      totalDatabases,
      totalDiskSize,
      crossRegion,
      warnings,
      recommendations
    };
  };

  const analysis = analyzePattern();

  // Trigger callback if provided
  React.useEffect(() => {
    if (onPatternDetected) {
      onPatternDetected(analysis);
    }
  }, [sourceInstances, targetInstances]);

  if (!showDetails) {
    return null;
  }

  // Render pattern analysis
  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    React.createElement(
      Box,
      { gap: 2, alignItems: 'center' },
      React.createElement(
        Text,
        { color: colorPalettes.dust.primary, bold: true },
        '🔍 Migration Pattern Analysis'
      ),
      React.createElement(
        Badge,
        { color: analysis.warnings.length > 0 ? 'yellow' : 'green' },
        analysis.pattern
      )
    ),

    React.createElement(
      Text,
      { color: colorPalettes.dust.secondary },
      analysis.description
    ),

    // Statistics
    React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 1 },
      React.createElement(
        Text,
        { color: 'gray' },
        `• Source instances: ${analysis.sourceCount}`
      ),
      React.createElement(
        Text,
        { color: 'gray' },
        `• Target instances: ${analysis.targetCount}`
      ),
      analysis.totalDatabases > 0 && React.createElement(
        Text,
        { color: 'gray' },
        `• Total databases: ${analysis.totalDatabases}`
      ),
      analysis.totalDiskSize > 0 && React.createElement(
        Text,
        { color: 'gray' },
        `• Total disk size: ${analysis.totalDiskSize} GB`
      ),
      analysis.crossRegion && React.createElement(
        Text,
        { color: 'yellow' },
        `• Cross-region: Yes`
      )
    ),

    // Warnings
    analysis.warnings.length > 0 && React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 1 },
      React.createElement(
        Text,
        { color: 'yellow', bold: true },
        '⚠️ Warnings:'
      ),
      ...analysis.warnings.map((warning, i) =>
        React.createElement(
          StatusMessage,
          { key: i, variant: 'warning' },
          warning
        )
      )
    ),

    // Recommendations
    analysis.recommendations.length > 0 && React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 1 },
      React.createElement(
        Text,
        { color: 'green', bold: true },
        '💡 Recommendations:'
      ),
      ...analysis.recommendations.map((rec, i) =>
        React.createElement(
          StatusMessage,
          { key: i, variant: 'info' },
          rec
        )
      )
    ),

    // Strategy suggestion
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.dust.primary },
        `Suggested strategy: `
      ),
      React.createElement(
        Text,
        { color: 'cyan', bold: true },
        analysis.strategy
      )
    )
  );
};

export default MigrationPatternDetector;