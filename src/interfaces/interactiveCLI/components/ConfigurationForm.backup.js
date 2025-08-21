import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  TextInput,
  Select,
  ConfirmInput,
  StatusMessage,
  ThemeProvider,
  extendTheme,
  defaultTheme
} from '@inkjs/ui';
import SimpleSelect from './SimpleSelect.js';
import OperationConfig from '../../../domain/models/operation-config.js';
import InstanceSelector from './InstanceSelector.js';

// Simplified theme that works with @inkjs/ui Select
const selectTheme = extendTheme(defaultTheme, {
  components: {
    Select: {
      styles: {
        container: () => ({
          flexDirection: 'column'
        })
      }
    }
  }
});

/**
 * Dynamic configuration form component using Ink UI
 * Handles step-by-step configuration with single-line inputs
 */
const ConfigurationForm = ({ toolName, onComplete, onCancel }) => {
  const [completedSteps, setCompletedSteps] = useState([]);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState(null);
  const [currentInputValue, setCurrentInputValue] = useState('');

  // Configuration steps for CloudSQL migration
  const getConfigSteps = () => {
    if (toolName === 'gcp.cloudsql.migrate') {
      return [
        {
          key: 'migrationMode',
          type: 'select',
          label: 'Migration Mode',
          options: [
            { label: 'Single instance migration', value: 'single' },
            { label: 'Multiple instances (batch)', value: 'batch' }
          ],
          defaultValue: 'single'
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
          required: true
        },
        {
          key: 'targetInstance',
          type: 'text',
          label: 'Target CloudSQL Instance',
          placeholder: 'Enter target instance name...',
          required: true
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
          type: 'confirm',
          label: 'Run in dry-run mode (simulation only)?',
          defaultValue: false
        },
        {
          key: 'retryAttempts',
          type: 'text',
          label: 'Number of retry attempts (1-10)',
          placeholder: '3',
          defaultValue: '3',
          validate: (value) => {
            const num = parseInt(value);
            return (num > 0 && num <= 10) || 'Enter a number between 1 and 10';
          }
        }
      ];
    }
    return [];
  };

  const steps = getConfigSteps();
  // const currentStepConfig = steps[currentStep];

  // Filter steps based on conditions
  const getVisibleSteps = () => {
    return steps.filter((step) => !step.condition || step.condition(formData));
  };

  const visibleSteps = getVisibleSteps();
  
  // Find the first uncompleted step
  const currentStep = visibleSteps.findIndex(
    step => !completedSteps.includes(step.key)
  );
  
  const actualCurrentStep = currentStep >= 0 ? visibleSteps[currentStep] : null;

  // Initialize currentInputValue when component mounts or step changes
  useEffect(() => {
    if (actualCurrentStep) {
      const savedValue =
        formData[actualCurrentStep.key] || actualCurrentStep.defaultValue || '';
      setCurrentInputValue(savedValue);
    }
  }, [actualCurrentStep?.key]);
  
  // Check if we're done
  useEffect(() => {
    if (currentStep === -1 && visibleSteps.length > 0) {
      // All visible steps completed
      buildFinalConfig().then(config => onComplete(config));
    }
  }, [currentStep, visibleSteps.length]);

  // Handle keyboard input for navigation within the form
  useInput((input, key) => {
    // Escape key for back navigation (handled at form level for immediate response)
    if (key.escape) {
      // Save current input value before navigating back (if it's not empty)
      if (currentInputValue && currentInputValue.trim() !== '') {
        handleInputChange(actualCurrentStep.key, currentInputValue);
      }

      if (completedSteps.length > 0) {
        // Remove the last completed step to go back
        const newCompleted = completedSteps.slice(0, -1);
        setCompletedSteps(newCompleted);
        setError(null);
      } else {
        // First step - go back to menu
        onCancel?.();
      }
    }

    // Handle Enter key for Select components to ensure default values are processed
    if (key.return && actualCurrentStep?.type === 'select') {
      const savedValue =
        formData[actualCurrentStep.key] || actualCurrentStep.defaultValue || '';
      if (savedValue) {
        handleInputChange(actualCurrentStep.key, savedValue);
        handleNext();
      }
    }
  });

  const handleNext = async () => {
    // Mark current step as completed
    if (actualCurrentStep) {
      setCompletedSteps(prev => [...prev, actualCurrentStep.key]);
    }
    
    setError(null);
  };

  // Note: Back functionality is handled by the useInput hook above

  const handleInputChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (value) => {
    const step = actualCurrentStep;
    // Use the current input value instead of the passed value
    const inputValue = value || currentInputValue;

    // Validate if required
    if (step.required && (!inputValue || inputValue.trim() === '')) {
      setError(`${step.label} is required`);
      return;
    }

    // Custom validation
    if (step.validate) {
      const validationResult = step.validate(inputValue);
      if (validationResult !== true) {
        setError(validationResult);
        return;
      }
    }

    handleInputChange(step.key, inputValue);
    handleNext();
  };

  const buildFinalConfig = async () => {
    // Check if batch migration
    if (formData.migrationMode === 'batch' && formData.sourceSelection) {
      // Import MigrationMapping for batch configurations
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
          retryAttempts: parseInt(formData.retryAttempts) || 3,
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
        retryAttempts: parseInt(formData.retryAttempts) || 3,
        verbose: false
      },
      metadata: {
        toolName,
        source: 'interactive-cli'
      }
    });
  };

  if (!actualCurrentStep) {
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

  const renderCurrentStep = () => {
    const step = actualCurrentStep;
    const savedValue = formData[step.key] || step.defaultValue || '';

    // Note: currentInputValue is now managed by useEffect

    switch (step.type) {
      case 'text':
        return React.createElement(TextInput, {
          key: `${step.key}-${currentStep}`, // Force new component instance for each step
          placeholder: step.placeholder,
          defaultValue: savedValue,
          onChange: (value) => setCurrentInputValue(value), // Track current input
          onSubmit: handleSubmit
        });

      case 'select':
        // Use SimpleSelect for better test compatibility
        const SelectComponent = process.env.NODE_ENV === 'test' ? SimpleSelect : Select;
        return React.createElement(SelectComponent, {
          key: `${step.key}-${currentStep}`, // Force new component instance for each step
          options: step.options,
          defaultValue: savedValue || step.defaultValue,
          onChange: (value) => {
            // Save the value when it changes
            if (value !== (savedValue || step.defaultValue)) {
              handleInputChange(step.key, value);
            }
          },
          onSubmit: (value) => {
            // Ensure value is set even if user just presses Enter on default
            const finalValue = value || savedValue || step.defaultValue;
            handleInputChange(step.key, finalValue);
            // Navigate to next step
            handleNext();
          }
        });

      case 'confirm':
        return React.createElement(ConfirmInput, {
          key: `${step.key}-${currentStep}`, // Force new component instance for each step
          defaultChoice: savedValue ? 'confirm' : 'cancel',
          onConfirm: () => {
            handleInputChange(step.key, true);
            handleNext();
          },
          onCancel: () => {
            handleInputChange(step.key, false);
            handleNext();
          }
        });

      case 'custom':
        // Handle custom components like InstanceSelector
        if (step.component === 'InstanceSelector') {
          return React.createElement(InstanceSelector, {
            key: `${step.key}-${currentStep}`,
            onComplete: (data) => {
              handleInputChange(step.key, data);
              handleNext();
            },
            onCancel: () => {
              if (completedSteps.length > 0) {
                // Go back by removing last completed step
                setCompletedSteps(prev => prev.slice(0, -1));
                setError(null);
              } else {
                onCancel?.();
              }
            }
          });
        }
        return React.createElement(
          Text,
          { color: 'red' },
          `Unknown custom component: ${step.component}`
        );

      default:
        return React.createElement(
          Text,
          { color: 'red' },
          `Unknown step type: ${step.type}`
        );
    }
  };

  return React.createElement(
    ThemeProvider,
    { theme: selectTheme },
    React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        Text,
        { color: 'cyan' },
        `🔧 ${actualCurrentStep.label} (${currentStep + 1}/${visibleSteps.length}):`
      ),
      error && React.createElement(StatusMessage, { variant: 'error' }, error),
      renderCurrentStep(),
      React.createElement(
        Text,
        { color: 'gray', dimColor: true },
        `${currentStep > 0 ? 'Esc: back' : 'Esc: cancel'} • Enter: continue • Alt+Q: quit`
      )
    )
  );
};

export default ConfigurationForm;
