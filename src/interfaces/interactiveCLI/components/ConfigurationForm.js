import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  TextInput,
  ConfirmInput,
  StatusMessage,
  ThemeProvider
} from '@inkjs/ui';
import customTheme, { colorPalettes } from '../theme/custom-theme.js';
import OperationConfig from '../../../domain/models/operation-config.js';
import InstanceSelector from './InstanceSelector.js';
import SimpleSelect from './SimpleSelect.js';
import ProjectScanner from './ProjectScanner.js';
import MigrationPatternDetector from './MigrationPatternDetector.js';
import SingleInstanceForm from './SingleInstanceForm.js';
// import CredentialsConfiguration from './CredentialsConfiguration.js'; // Removed - now integrated in ProjectScanner
import { getAvailableStrategies, getConflictResolutionOptions } from '../../../domain/strategies/migration-strategies.js';

// Use custom theme for consistent styling

/**
 * Fixed configuration form with proper batch flow
 */
const ConfigurationForm = ({ toolName, onComplete, onCancel }) => {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [navigationHistory, setNavigationHistory] = useState([{}]); // Track navigation history for back navigation
  const [stepHistory, setStepHistory] = useState([0]); // Track step index history for proper back navigation

  // Get all configuration steps
  const getAllSteps = () => {
    if (toolName === 'gcp.cloudsql.migrate') {
      return [
        {
          key: 'migrationMode',
          type: 'select',
          label: 'Migration Mode',
          options: [
            { label: 'Single or Batch Guided with AutoDiscovery', value: 'interactive' },
            { label: 'Single Instance Migration', value: 'single' },
            { label: 'Batch Migration (Multiple Instances)', value: 'batch' }
          ],
          defaultValue: 'interactive'
        },
        {
          key: 'sourceProjectScan',
          type: 'custom',
          label: 'Source Project and Instances',
          component: 'ProjectScanner',
          componentProps: { isSource: true, allowMultiple: true, requireCredentials: true },
          condition: (data) => data.migrationMode === 'interactive'
        },
        {
          key: 'targetProjectScan',
          type: 'custom',
          label: 'Target Project and Instances',
          component: 'ProjectScanner',
          componentProps: { isSource: false, allowMultiple: true, requireCredentials: true },
          condition: (data) => data.migrationMode === 'interactive'
        },
        {
          key: 'migrationPattern',
          type: 'custom',
          label: 'Migration Pattern Analysis',
          component: 'MigrationPatternDetector',
          condition: (data) => data.migrationMode === 'interactive' && data.sourceProjectScan && data.targetProjectScan
        },
        {
          key: 'migrationStrategy',
          type: 'select',
          label: 'Migration Strategy',
          options: (data) => getAvailableStrategies(data.migrationPattern?.pattern),
          defaultValue: (data) => data.migrationPattern?.strategy,
          condition: (data) => (
            (data.migrationMode === 'interactive' && data.migrationPattern) ||
            (data.migrationMode === 'batch')
          )
        },
        {
          key: 'conflictResolution',
          type: 'select',
          label: 'Database Name Conflict Resolution',
          options: (data) => getConflictResolutionOptions(data.migrationStrategy || data.batchStrategy),
          defaultValue: 'fail',
          condition: (data) => (
            (data.migrationMode === 'interactive' && data.migrationStrategy && 
             ['consolidate', 'manual-mapping'].includes(data.migrationStrategy)) ||
            (data.migrationMode === 'batch' && data.batchStrategy === 'consolidate')
          )
        },
        // Credentials now integrated into ProjectScanner for better UX
        {
          key: 'sourceSelection',
          type: 'custom',
          label: 'Select Source Instances',
          component: 'InstanceSelector',
          condition: (data) => data.migrationMode === 'batch'
        },
        {
          key: 'singleInstanceConfig',
          type: 'custom',
          label: 'Instance Configuration',
          component: 'SingleInstanceForm',
          condition: (data) => data.migrationMode === 'single'
        },
        {
          key: 'targetProject',
          type: 'text',
          label: 'Target GCP Project',
          placeholder: 'Enter target project ID...',
          required: true,
          condition: (data) => data.migrationMode === 'batch'
        },
        {
          key: 'targetInstance',
          type: 'text',
          label: 'Target CloudSQL Instance',
          placeholder: 'Enter target instance name...',
          required: true,
          condition: (data) => data.migrationMode === 'batch'
        },
        {
          key: 'batchStrategy',
          type: 'select',
          label: 'Batch Migration Strategy',
          options: [
            { label: 'Consolidate to single target (N:1)', value: 'consolidate' },
            { label: 'Version-based mapping (N:N)', value: 'version-based' },
            { label: 'Custom mapping', value: 'custom' }
          ],
          defaultValue: 'consolidate',
          condition: (data) => data.migrationMode === 'batch'
        },
        {
          key: 'conflictResolution',
          type: 'select',
          label: 'Database Name Conflict Resolution',
          options: [
            { label: 'Fail on conflict', value: 'fail' },
            { label: 'Prefix with instance name', value: 'prefix' },
            { label: 'Add numeric suffix', value: 'suffix' },
            { label: 'Merge databases', value: 'merge' }
          ],
          defaultValue: 'fail',
          condition: (data) => data.migrationMode === 'batch' && data.batchStrategy === 'consolidate'
        },
        {
          key: 'databaseSelection',
          type: 'select',
          label: 'Database Selection',
          options: [
            { label: 'All databases', value: 'all' },
            { label: 'Specific databases', value: 'specific' }
          ],
          defaultValue: 'all'
        },
        {
          key: 'databases',
          type: 'text',
          label: 'Database Names (comma-separated)',
          placeholder: 'db1, db2, db3...',
          condition: (data) => data.databaseSelection === 'specific'
        },
        {
          key: 'dataMode',
          type: 'select',
          label: 'Migration Data Mode',
          options: [
            { label: 'Full migration (schema + data)', value: 'full' },
            { label: 'Schema only', value: 'schema' },
            { label: 'Data only', value: 'data' }
          ],
          defaultValue: 'full'
        },
        {
          key: 'dryRun',
          type: 'select',
          label: 'Migration Execution Mode',
          options: [
            { label: '🚀 Execute real migration', value: false },
            { label: '🎭 Run simulation only (dry-run)', value: true }
          ],
          defaultValue: false
        }
      ];
    }
    return [];
  };

  const allSteps = getAllSteps();

  // Get visible steps based on current form data
  const getVisibleSteps = () => {
    const visible = allSteps.filter((step) => !step.condition || step.condition(formData));
    // Ensure at least the first step is always visible
    if (visible.length === 0 && allSteps.length > 0) {
      return [allSteps[0]];
    }
    return visible;
  };

  // Track when form data changes (useful for debugging)
  useEffect(() => {
    // This effect can be used for debugging or future enhancements
  }, [formData]);

  // Get current step
  const getCurrentStep = () => {
    const visibleSteps = getVisibleSteps();
    if (currentStepIndex < 0 || currentStepIndex >= visibleSteps.length) {
      // Reset to first step if index is out of bounds
      if (visibleSteps.length > 0) {
        setCurrentStepIndex(0);
        return visibleSteps[0];
      }
      return null;
    }
    return visibleSteps[currentStepIndex];
  };

  const currentStep = getCurrentStep();

  // Handle keyboard navigation
  useInput((input, key) => {
    if (key.escape) {
      handleBack();
    }
  });
  
  // Handle going back to previous step
  const handleBack = () => {
    if (stepHistory.length > 1) {
      // Remove current step from history
      const newStepHistory = [...stepHistory];
      newStepHistory.pop();
      
      // Get the previous step index
      const previousStepIndex = newStepHistory[newStepHistory.length - 1];
      
      // Remove current state from navigation history
      const newNavigationHistory = [...navigationHistory];
      newNavigationHistory.pop();
      
      // Get the previous state
      const previousState = newNavigationHistory[newNavigationHistory.length - 1] || {};
      
      // Update all states
      setStepHistory(newStepHistory);
      setNavigationHistory(newNavigationHistory);
      setFormData(previousState);
      setCurrentStepIndex(previousStepIndex);
      setError(null);
    } else {
      // We're at the first step, cancel the form
      onCancel?.();
    }
  };

  // Handle moving to next step
  const handleNext = async () => {
    const visibleSteps = getVisibleSteps();
    
    if (currentStepIndex + 1 >= visibleSteps.length) {
      // All steps completed, build final config
      const config = await buildFinalConfig();
      onComplete(config);
    } else {
      // Find the actual next step index considering conditions
      let nextStepIndex = -1;
      const allSteps = getAllSteps();
      const currentStepKey = visibleSteps[currentStepIndex]?.key;
      
      // Find current step in all steps
      let foundCurrent = false;
      for (let i = 0; i < allSteps.length; i++) {
        if (allSteps[i].key === currentStepKey) {
          foundCurrent = true;
          continue;
        }
        
        if (foundCurrent) {
          // Check if this next step is visible
          if (!allSteps[i].condition || allSteps[i].condition(formData)) {
            // Find this step's index in visible steps
            const visibleIndex = visibleSteps.findIndex(s => s.key === allSteps[i].key);
            if (visibleIndex !== -1) {
              nextStepIndex = visibleIndex;
              break;
            }
          }
        }
      }
      
      if (nextStepIndex === -1) {
        // Fallback to simple increment
        nextStepIndex = currentStepIndex + 1;
      }
      
      // Save current state and step index to history
      const newNavigationHistory = [...navigationHistory, { ...formData }];
      const newStepHistory = [...stepHistory, nextStepIndex];
      
      setNavigationHistory(newNavigationHistory);
      setStepHistory(newStepHistory);
      setCurrentStepIndex(nextStepIndex);
    }
    setError(null);
  };

  // Handle input change
  const handleInputChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Handle input submission
  const handleSubmit = (value) => {
    if (!currentStep) return;

    // Validate if required
    if (currentStep.required && (!value || value.trim() === '')) {
      setError(`${currentStep.label} is required`);
      return;
    }

    // Custom validation
    if (currentStep.validate) {
      const validationResult = currentStep.validate(value);
      if (validationResult !== true) {
        setError(validationResult);
        return;
      }
    }

    handleInputChange(currentStep.key, value);
    handleNext();
  };

  // Build final configuration
  const buildFinalConfig = async () => {
    // Check if interactive migration
    if (formData.migrationMode === 'interactive' && formData.sourceProjectScan && formData.targetProjectScan) {
      const { default: MigrationMapping } = await import(
        '../../../domain/models/migration-mapping.js'
      );

      const pattern = formData.migrationPattern || {};
      // Credentials now come directly from instances

      // Create mapping based on user-selected strategy
      const mapping = new MigrationMapping({
        strategy: formData.migrationStrategy || pattern.strategy || 'simple',
        sources: formData.sourceProjectScan.instances.map(inst => ({
          project: inst.project,
          instance: inst.instance,
          databases: inst.databases,
          user: inst.credentials?.user || 'postgres',
          password: inst.credentials?.password,
          ip: inst.publicIp || inst.ip
        })),
        targets: formData.targetProjectScan.instances.map(inst => ({
          project: inst.project,
          instance: inst.instance,
          user: inst.credentials?.user || 'postgres',
          password: inst.credentials?.password,
          ip: inst.publicIp || inst.ip
        })),
        conflictResolution: formData.conflictResolution || 'fail',
        options: {
          includeAll: true,
          schemaOnly: formData.dataMode === 'schema',
          dataOnly: formData.dataMode === 'data',
          dryRun: formData.dryRun || false,
          retryAttempts: 3,
          verbose: false,
          maxParallel: pattern.pattern === 'N:N' ? 3 : 1
        },
        metadata: {
          pattern: pattern.pattern,
          sourceCount: pattern.sourceCount,
          targetCount: pattern.targetCount
        }
      });

      return {
        isBatch: true, // Always treat interactive mode as batch for consistent handling
        mapping,
        metadata: {
          toolName,
          source: 'interactive-cli',
          mode: 'interactive',
          pattern: pattern.pattern
        }
      };
    }

    // Check if batch migration
    if (formData.migrationMode === 'batch' && formData.sourceSelection) {
      const { default: MigrationMapping } = await import(
        '../../../domain/models/migration-mapping.js'
      );

      // For batch mode, we'll still use traditional credential config until updated
      const mapping = new MigrationMapping({
        strategy: formData.batchStrategy || 'consolidate',
        sources: formData.sourceSelection.instances.map(inst => ({
          ...inst,
          user: inst.credentials?.user || 'postgres',
          password: inst.credentials?.password
        })),
        targets: [{
          project: formData.targetProject,
          instance: formData.targetInstance,
          user: 'postgres', // Batch mode target still uses defaults for now
          password: undefined
        }],
        conflictResolution: formData.conflictResolution || 'fail',
        options: {
          includeAll: formData.databaseSelection === 'all',
          schemaOnly: formData.dataMode === 'schema',
          dataOnly: formData.dataMode === 'data',
          dryRun: formData.dryRun || false,
          retryAttempts: 3,
          verbose: false
        }
      });

      return {
        isBatch: true,
        mapping,
        metadata: {
          toolName,
          source: 'interactive-cli',
          mode: 'batch'
        }
      };
    }

    // Single migration configuration
    const databases =
      formData.databaseSelection === 'specific'
        ? formData.databases
            ?.split(',')
            .map((db) => db.trim())
            .filter(Boolean)
        : null;

    // Extract configuration from SingleInstanceForm
    const singleConfig = formData.singleInstanceConfig || {};

    return new OperationConfig({
      source: {
        project: singleConfig.source?.project || formData.sourceProject,
        instance: singleConfig.source?.instance || formData.sourceInstance,
        databases,
        user: singleConfig.source?.credentials?.user || 'postgres',
        password: singleConfig.source?.credentials?.password
      },
      target: {
        project: singleConfig.target?.project || formData.targetProject,
        instance: singleConfig.target?.instance || formData.targetInstance,
        user: singleConfig.target?.credentials?.user || 'postgres',
        password: singleConfig.target?.credentials?.password
      },
      options: {
        includeAll: formData.databaseSelection === 'all',
        schemaOnly: formData.dataMode === 'schema',
        dataOnly: formData.dataMode === 'data',
        dryRun: formData.dryRun || false,
        retryAttempts: 3,
        verbose: false
      },
      metadata: {
        toolName,
        source: 'interactive-cli'
      }
    });
  };

  // Render current step
  const renderCurrentStep = () => {
    if (!currentStep) return null;

    const savedValue = formData[currentStep.key] || currentStep.defaultValue || '';

    switch (currentStep.type) {
      case 'text':
        return React.createElement(TextInput, {
          key: currentStep.key,
          placeholder: currentStep.placeholder,
          defaultValue: savedValue,
          onSubmit: handleSubmit
        });

      case 'select':
        // Handle dynamic options and defaultValue
        const options = typeof currentStep.options === 'function' 
          ? currentStep.options(formData) 
          : currentStep.options;
        const defaultValue = typeof currentStep.defaultValue === 'function'
          ? currentStep.defaultValue(formData)
          : currentStep.defaultValue;
        
        // Use SimpleSelect for better control
        return React.createElement(SimpleSelect, {
          key: currentStep.key,
          options: options,
          defaultValue: savedValue || defaultValue,
          showNavigationHints: false, // ConfigurationForm already shows hints
          onSubmit: (value) => {
            // Convert string 'true'/'false' to boolean for dryRun
            const finalValue = currentStep.key === 'dryRun' 
              ? value === true || value === 'true'
              : value;
            handleInputChange(currentStep.key, finalValue);
            handleNext();
          }
        });

      case 'confirm':
        return React.createElement(ConfirmInput, {
          key: currentStep.key,
          defaultChoice: savedValue ? 'confirm' : 'cancel',
          onConfirm: () => {
            handleInputChange(currentStep.key, true);
            handleNext();
          },
          onCancel: () => {
            handleInputChange(currentStep.key, false);
            handleNext();
          }
        });

      case 'custom':
        // Handle different custom components
        const componentProps = {
          key: currentStep.key,
          onComplete: (data) => {
            handleInputChange(currentStep.key, data);
            handleNext();
          },
          onCancel: (preservedData) => {
            // Save any preserved data before going back
            if (preservedData) {
              handleInputChange(currentStep.key, preservedData);
            }
            handleBack();
          },
          ...(currentStep.componentProps || {})
        };

        switch (currentStep.component) {
          case 'InstanceSelector':
            return React.createElement(InstanceSelector, componentProps);
            
          case 'ProjectScanner':
            return React.createElement(ProjectScanner, {
              ...componentProps,
              label: currentStep.componentProps?.isSource 
                ? 'Source GCP Project' 
                : 'Target GCP Project',
              initialData: formData[currentStep.key], // Pass saved data for restoration
              onComplete: (data) => {
                handleInputChange(currentStep.key, data);
                handleNext();
              },
              onCancel: (preservedData) => {
                // Save any preserved data before going back
                if (preservedData) {
                  handleInputChange(currentStep.key, preservedData);
                }
                handleBack();
              }
            });
            
          case 'MigrationPatternDetector':
            return React.createElement(MigrationPatternDetector, {
              sourceInstances: formData.sourceProjectScan?.instances || [],
              targetInstances: formData.targetProjectScan?.instances || [],
              onPatternDetected: (pattern) => {
                handleInputChange(currentStep.key, pattern);
                // Don't auto-advance - let user review and press Enter
              },
              showDetails: true,
              onConfirm: handleNext
            });
            
          case 'SingleInstanceForm':
            return React.createElement(SingleInstanceForm, {
              ...componentProps,
              initialData: formData[currentStep.key] || {}, // Pass saved form data
              onComplete: (data) => {
                handleInputChange(currentStep.key, data);
                handleNext();
              },
              onCancel: (preservedData) => {
                // Save current form state before going back
                if (preservedData) {
                  handleInputChange(currentStep.key, preservedData);
                }
                handleBack();
              }
            });
            
          // CredentialsConfiguration removed - now integrated in ProjectScanner
            
          default:
            return React.createElement(
              Text,
              { color: 'red' },
              `Unknown custom component: ${currentStep.component}`
            );
        }

      default:
        return React.createElement(
          Text,
          { color: 'red' },
          `Unknown step type: ${currentStep.type}`
        );
    }
  };

  if (!currentStep) {
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        StatusMessage,
        { variant: 'error' },
        `No configuration steps defined for ${toolName}`
      )
    );
  }

  const visibleSteps = getVisibleSteps();
  const stepNumber = currentStepIndex + 1;
  const totalSteps = visibleSteps.length;

  return React.createElement(
    ThemeProvider,
    { theme: customTheme },
    React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.dust.primary },
        `🔧 ${currentStep.label} (${stepNumber}/${totalSteps}):`
      ),
      error && React.createElement(StatusMessage, { variant: 'error' }, error),
      renderCurrentStep(),
      React.createElement(
        Text,
        { color: '#ac8500' },
        `${currentStepIndex > 0 ? 'Esc: back' : 'Esc: cancel'} • Enter: continue • Ctrl+X: quit`
      )
    )
  );
};

export default ConfigurationForm;