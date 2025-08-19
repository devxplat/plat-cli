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
import PasswordConfiguration from './PasswordConfiguration.js';

// Use custom theme for consistent styling

/**
 * Fixed configuration form with proper batch flow
 */
const ConfigurationForm = ({ toolName, onComplete, onCancel }) => {
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Get all configuration steps
  const getAllSteps = () => {
    if (toolName === 'gcp.cloudsql.migrate') {
      return [
        {
          key: 'migrationMode',
          type: 'select',
          label: 'Migration Mode',
          options: [
            { label: 'Interactive (Scan Projects)', value: 'interactive' },
            { label: 'Single instance migration', value: 'single' },
            { label: 'Multiple instances (batch)', value: 'batch' }
          ],
          defaultValue: 'single'
        },
        {
          key: 'sourceProjectScan',
          type: 'custom',
          label: 'Source Project and Instances',
          component: 'ProjectScanner',
          componentProps: { isSource: true, allowMultiple: true },
          condition: (data) => data.migrationMode === 'interactive'
        },
        {
          key: 'targetProjectScan',
          type: 'custom',
          label: 'Target Project and Instances',
          component: 'ProjectScanner',
          componentProps: { isSource: false, allowMultiple: true },
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
          key: 'passwordConfig',
          type: 'custom',
          label: 'Password Configuration',
          component: 'PasswordConfiguration',
          condition: (data) => data.migrationMode === 'interactive' && data.sourceProjectScan && data.targetProjectScan
        },
        {
          key: 'sourceSelection',
          type: 'custom',
          label: 'Select Source Instances',
          component: 'InstanceSelector',
          condition: (data) => data.migrationMode === 'batch'
        },
        {
          key: 'sourceProject',
          type: 'text',
          label: 'Source GCP Project',
          placeholder: 'Enter source project ID...',
          required: true,
          condition: (data) => data.migrationMode === 'single'
        },
        {
          key: 'sourceInstance',
          type: 'text',
          label: 'Source CloudSQL Instance',
          placeholder: 'Enter source instance name...',
          required: true,
          condition: (data) => data.migrationMode === 'single'
        },
        {
          key: 'targetProject',
          type: 'text',
          label: 'Target GCP Project',
          placeholder: 'Enter target project ID...',
          required: true,
          condition: (data) => data.migrationMode !== 'interactive'
        },
        {
          key: 'targetInstance',
          type: 'text',
          label: 'Target CloudSQL Instance',
          placeholder: 'Enter target instance name...',
          required: true,
          condition: (data) => data.migrationMode !== 'interactive'
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
      if (currentStepIndex > 0) {
        setCurrentStepIndex(prev => prev - 1);
        setError(null);
      } else {
        onCancel?.();
      }
    }
  });

  // Handle moving to next step
  const handleNext = async () => {
    const visibleSteps = getVisibleSteps();
    if (currentStepIndex + 1 >= visibleSteps.length) {
      // All steps completed, build final config
      const config = await buildFinalConfig();
      onComplete(config);
    } else {
      setCurrentStepIndex(prev => prev + 1);
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
      const passwords = formData.passwordConfig?.passwords || {};
      const passwordMode = formData.passwordConfig?.mode || 'single';
      
      // Get single password if in single mode
      const singlePassword = passwordMode === 'single' && passwords[Object.keys(passwords)[0]]?.value;

      // Create mapping based on detected pattern
      const mapping = new MigrationMapping({
        strategy: pattern.strategy || 'simple',
        sources: formData.sourceProjectScan.instances.map(inst => ({
          project: inst.project,
          instance: inst.instance,
          databases: inst.databases,
          user: 'postgres',
          password: passwordMode === 'single' 
            ? singlePassword 
            : passwords[`${inst.project}:${inst.instance}`]?.value,
          ip: inst.publicIp || inst.ip
        })),
        targets: formData.targetProjectScan.instances.map(inst => ({
          project: inst.project,
          instance: inst.instance,
          user: 'postgres',
          password: passwordMode === 'single' 
            ? singlePassword 
            : passwords[`${inst.project}:${inst.instance}`]?.value,
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

      const mapping = new MigrationMapping({
        strategy: formData.batchStrategy || 'consolidate',
        sources: formData.sourceSelection.instances,
        targets: [{
          project: formData.targetProject,
          instance: formData.targetInstance
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

    return new OperationConfig({
      source: {
        project: formData.sourceProject,
        instance: formData.sourceInstance,
        databases
      },
      target: {
        project: formData.targetProject,
        instance: formData.targetInstance
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
        // Use SimpleSelect for better control
        return React.createElement(SimpleSelect, {
          key: currentStep.key,
          options: currentStep.options,
          defaultValue: savedValue || currentStep.defaultValue,
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
          onCancel: () => {
            if (currentStepIndex > 0) {
              setCurrentStepIndex(prev => prev - 1);
              setError(null);
            } else {
              onCancel?.();
            }
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
                : 'Target GCP Project'
            });
            
          case 'MigrationPatternDetector':
            return React.createElement(MigrationPatternDetector, {
              sourceInstances: formData.sourceProjectScan?.instances || [],
              targetInstances: formData.targetProjectScan?.instances || [],
              onPatternDetected: (pattern) => {
                handleInputChange(currentStep.key, pattern);
                // Auto-advance after showing pattern for 3 seconds
                setTimeout(() => handleNext(), 3000);
              },
              showDetails: true
            });
            
          case 'PasswordConfiguration':
            const allInstances = [
              ...(formData.sourceProjectScan?.instances || []),
              ...(formData.targetProjectScan?.instances || [])
            ];
            return React.createElement(PasswordConfiguration, {
              ...componentProps,
              instances: allInstances
            });
            
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