/**
 * Shared Migration Strategy Logic
 * Used by both TUI and CLI Classic interfaces to ensure consistent behavior
 */

/**
 * Get available migration strategies based on detected pattern
 * @param {string} pattern - Migration pattern (1:1, N:1, N:N, 1:N, N:M)
 * @returns {Array} Array of strategy options with label and value
 */
export const getAvailableStrategies = (pattern) => {
  const strategies = {
    '1:1': [
      { label: 'Simple direct migration', value: 'simple' }
    ],
    'N:1': [
      { label: 'Consolidate to single target (Recommended)', value: 'consolidate' },
      { label: 'Manual mapping', value: 'manual-mapping' }
    ],
    'N:N': [
      { label: 'Version-based mapping (Recommended)', value: 'version-based' },
      { label: 'Manual mapping', value: 'manual-mapping' },
      { label: 'Round-robin distribution', value: 'round-robin' }
    ],
    '1:N': [
      { label: 'Distribute databases (Recommended)', value: 'distribute' },
      { label: 'Replicate to all targets', value: 'replicate' },
      { label: 'Split by database pattern', value: 'split-by-database' }
    ],
    'N:M': [
      { label: 'Manual mapping (Recommended)', value: 'manual-mapping' },
      { label: 'Version-based mapping', value: 'version-based' },
      { label: 'Round-robin distribution', value: 'round-robin' }
    ]
  };

  return strategies[pattern] || strategies['1:1'];
};

/**
 * Get available conflict resolution options based on selected strategy
 * @param {string} strategy - Selected migration strategy
 * @returns {Array} Array of conflict resolution options with label and value
 */
export const getConflictResolutionOptions = (strategy) => {
  const baseOptions = [
    { label: 'Fail on conflict', value: 'fail' },
    { label: 'Prefix with instance name', value: 'prefix' },
    { label: 'Add numeric suffix', value: 'suffix' }
  ];
  
  if (strategy === 'consolidate') {
    baseOptions.push({ label: 'Merge databases', value: 'merge' });
  }
  
  if (strategy === 'custom' || strategy === 'manual-mapping') {
    baseOptions.push({ label: 'Rename schema', value: 'rename-schema' });
  }
  
  return baseOptions;
};

/**
 * Get recommended strategy for a migration pattern
 * @param {string} pattern - Migration pattern (1:1, N:1, N:N, 1:N, N:M)
 * @returns {string} Recommended strategy value
 */
export const getRecommendedStrategy = (pattern) => {
  const recommendations = {
    '1:1': 'simple',
    'N:1': 'consolidate',
    'N:N': 'version-based',
    '1:N': 'distribute',
    'N:M': 'manual-mapping'
  };

  return recommendations[pattern] || 'simple';
};

/**
 * Detect migration pattern based on source and target counts
 * @param {number} sourceCount - Number of source instances
 * @param {number} targetCount - Number of target instances
 * @returns {string} Migration pattern (1:1, N:1, N:N, 1:N, N:M)
 */
export const detectMigrationPattern = (sourceCount, targetCount) => {
  if (sourceCount === 1 && targetCount === 1) {
    return '1:1';
  } else if (sourceCount > 1 && targetCount === 1) {
    return 'N:1';
  } else if (sourceCount === 1 && targetCount > 1) {
    return '1:N';
  } else if (sourceCount > 1 && targetCount > 1) {
    if (sourceCount === targetCount) {
      return 'N:N';
    } else {
      return 'N:M';
    }
  }
  
  return '1:1'; // Default fallback
};

/**
 * Validate strategy compatibility with migration pattern
 * @param {string} strategy - Selected strategy
 * @param {string} pattern - Migration pattern
 * @returns {Object} Validation result with valid boolean and warnings array
 */
export const validateStrategyCompatibility = (strategy, pattern) => {
  const compatibilityMatrix = {
    'simple': ['1:1'],
    'consolidate': ['N:1', 'N:N', 'N:M'],
    'distribute': ['1:N'],
    'replicate': ['1:N'],
    'version-based': ['N:N', 'N:M'],
    'round-robin': ['N:N', 'N:M'],
    'split-by-database': ['1:N'],
    'manual-mapping': ['N:1', 'N:N', '1:N', 'N:M'],
    'custom': ['1:1', 'N:1', 'N:N', '1:N', 'N:M']
  };

  const compatiblePatterns = compatibilityMatrix[strategy] || [];
  const isValid = compatiblePatterns.includes(pattern);
  
  const warnings = [];
  if (!isValid) {
    warnings.push(`Strategy "${strategy}" is not optimal for pattern "${pattern}". Consider using the recommended strategy.`);
  }

  return {
    valid: true, // Always allow but warn
    compatible: isValid,
    warnings
  };
};

/**
 * Get all available strategy values (for CLI parameter validation)
 * @returns {Array} Array of all strategy values
 */
export const getAllStrategyValues = () => {
  return [
    'simple',
    'consolidate', 
    'distribute',
    'replicate',
    'version-based',
    'round-robin',
    'split-by-database',
    'manual-mapping',
    'custom'
  ];
};

/**
 * Get all available conflict resolution values (for CLI parameter validation)
 * @returns {Array} Array of all conflict resolution values
 */
export const getAllConflictResolutionValues = () => {
  return [
    'fail',
    'prefix',
    'suffix',
    'merge',
    'rename-schema'
  ];
};

/**
 * Get strategy description for help text
 * @param {string} strategy - Strategy value
 * @returns {string} Human-readable description
 */
export const getStrategyDescription = (strategy) => {
  const descriptions = {
    'simple': 'Direct 1:1 migration between instances',
    'consolidate': 'Combine multiple sources into single target',
    'distribute': 'Distribute databases across multiple targets',
    'replicate': 'Replicate source to all target instances',
    'version-based': 'Map instances based on PostgreSQL version compatibility',
    'round-robin': 'Distribute sources across targets in round-robin fashion',
    'split-by-database': 'Split databases based on naming patterns',
    'manual-mapping': 'User-defined source to target mapping',
    'custom': 'Custom migration strategy with advanced options'
  };

  return descriptions[strategy] || 'Unknown strategy';
};

/**
 * Get conflict resolution description for help text
 * @param {string} resolution - Conflict resolution value
 * @returns {string} Human-readable description
 */
export const getConflictResolutionDescription = (resolution) => {
  const descriptions = {
    'fail': 'Stop migration if database name conflicts occur',
    'prefix': 'Add source instance name as prefix to conflicting databases',
    'suffix': 'Add numeric suffix to conflicting database names',
    'merge': 'Attempt to merge conflicting databases (consolidate strategy only)',
    'rename-schema': 'Rename schema instead of database (advanced strategies only)'
  };

  return descriptions[resolution] || 'Unknown conflict resolution';
};