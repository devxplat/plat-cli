import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  TextInput,
  Select,
  MultiSelect,
  ConfirmInput,
  StatusMessage
} from '@inkjs/ui';
import { colorPalettes } from '../theme/custom-theme.js';
import ProjectScanner from './ProjectScanner.js';

/**
 * Instance Selector Component
 * Allows selection of multiple instances for batch migration
 * Now supports project scanning mode
 */
const InstanceSelector = ({ onComplete, onCancel, enableProjectScan = true }) => {
  const [mode, setMode] = useState('selection'); // selection, file, manual, project-scan
  const [instances, setInstances] = useState([]);
  const [filePath, setFilePath] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState('mode'); // mode, input, confirm

  // Handle keyboard navigation
  useInput((input, key) => {
    if (key.escape) {
      if (currentStep !== 'mode') {
        setCurrentStep('mode');
        setError(null);
      } else {
        onCancel?.();
      }
    }
  });

  // Load instances from file
  const loadInstancesFromFile = async (path) => {
    setLoading(true);
    setError(null);

    try {
      const { default: InstanceParser } = await import(
        '../../../infrastructure/utils/instance-parser.js'
      );
      const parser = new InstanceParser();
      const parsedData = await parser.parseFile(path);

      // Extract instance list from parsed data
      const instanceList = parsedData.sources || [];
      
      if (instanceList.length === 0) {
        throw new Error('No instances found in file');
      }

      setInstances(instanceList);
      setCurrentStep('confirm');
    } catch (err) {
      setError(`Failed to load instances: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Parse manual input
  const parseManualInput = (input) => {
    const lines = input
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);

    const instanceList = lines.map(line => {
      // Support format: project:instance or just instance
      const parts = line.split(':');
      if (parts.length === 2) {
        return {
          project: parts[0],
          instance: parts[1],
          label: line
        };
      }
      return {
        instance: line,
        label: line
      };
    });

    return instanceList;
  };

  // Render based on current step
  const renderStep = () => {
    switch (currentStep) {
      case 'mode':
        return renderModeSelection();
      case 'input':
        return renderInputStep();
      case 'confirm':
        return renderConfirmation();
      default:
        return null;
    }
  };

  // Render mode selection
  const renderModeSelection = () => {
    const options = [
      ...(enableProjectScan ? [{ label: 'Scan GCP project for instances', value: 'project-scan' }] : []),
      { label: 'Load from file (txt/json/csv)', value: 'file' },
      { label: 'Enter instances manually', value: 'manual' },
      { label: 'Use example instances.txt', value: 'example' }
    ];

    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.dust.primary },
        '🔧 How would you like to select instances?'
      ),
      React.createElement(Select, {
        options,
        onChange: async (value) => {
          setMode(value);
          if (value === 'example') {
            // Load the example instances.txt file
            loadInstancesFromFile('instances.txt');
          } else if (value === 'project-scan') {
            // Switch to project scan mode
            setCurrentStep('project-scan');
          } else {
            setCurrentStep('input');
          }
        }
      })
    );
  };

  // Render input step based on mode
  const renderInputStep = () => {
    if (mode === 'project-scan') {
      // Render the ProjectScanner component
      return React.createElement(ProjectScanner, {
        label: 'Enter GCP Project to scan',
        onComplete: (result) => {
          setInstances(result.instances);
          setCurrentStep('confirm');
        },
        onCancel: () => {
          setCurrentStep('mode');
        },
        allowMultiple: true
      });
    }

    if (mode === 'file') {
      return React.createElement(
        Box,
        { flexDirection: 'column', gap: 1 },
        React.createElement(
          Text,
          { color: colorPalettes.dust.primary },
          '📁 Enter path to instances file:'
        ),
        React.createElement(TextInput, {
          placeholder: 'path/to/instances.txt',
          defaultValue: filePath,
          onChange: setFilePath,
          onSubmit: async (value) => {
            if (value) {
              await loadInstancesFromFile(value);
            }
          }
        }),
        error && React.createElement(
          StatusMessage,
          { variant: 'error' },
          error
        ),
        React.createElement(
          Text,
          { color: colorPalettes.dust.tertiary },
          'Supported formats: .txt, .json, .csv'
        )
      );
    }

    if (mode === 'manual') {
      return React.createElement(
        Box,
        { flexDirection: 'column', gap: 1 },
        React.createElement(
          Text,
          { color: colorPalettes.dust.primary },
          '✏️ Enter instances (one per line, format: project:instance or instance):'
        ),
        React.createElement(
          Text,
          { color: 'gray' },
          'Example: my-project:my-instance or just my-instance'
        ),
        React.createElement(TextInput, {
          placeholder: 'Enter instances and press Enter when done...',
          defaultValue: manualInput,
          onChange: setManualInput,
          onSubmit: (value) => {
            if (value) {
              const instanceList = parseManualInput(value);
              if (instanceList.length > 0) {
                setInstances(instanceList);
                setCurrentStep('confirm');
              } else {
                setError('Please enter at least one instance');
              }
            }
          }
        }),
        error && React.createElement(
          StatusMessage,
          { variant: 'error' },
          error
        ),
        React.createElement(
          Text,
          { color: '#ac8500' },
          'Press Enter when done, Esc to go back'
        )
      );
    }

    return null;
  };

  // Render confirmation step
  const renderConfirmation = () => {
    if (instances.length === 0) {
      return React.createElement(
        StatusMessage,
        { variant: 'error' },
        'No instances loaded'
      );
    }

    // For MultiSelect, we need to format instances properly
    const selectOptions = instances.map((inst, index) => ({
      label: inst.label || `${inst.project || 'default'}:${inst.instance}`,
      value: index.toString()
    }));

    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.dust.primary },
        `📋 Found ${instances.length} instances. Select instances to migrate:`
      ),
      instances.length <= 20 ? (
        React.createElement(MultiSelect, {
          options: selectOptions,
          defaultValue: selectOptions.map(o => o.value), // Select all by default
          onSubmit: (values) => {
            const selected = values.map(v => instances[parseInt(v)]);
            if (selected.length > 0) {
              onComplete({
                instances: selected,
                mode,
                totalSelected: selected.length,
                totalAvailable: instances.length
              });
            } else {
              setError('Please select at least one instance');
            }
          }
        })
      ) : (
        // Too many instances for MultiSelect, use confirmation
        React.createElement(
          Box,
          { flexDirection: 'column', gap: 1 },
          React.createElement(
            Box,
            { flexDirection: 'column' },
            instances.slice(0, 5).map((inst, index) => 
              React.createElement(
                Text,
                { key: index, color: 'gray' },
                `  • ${inst.label || `${inst.project || 'default'}:${inst.instance}`}`
              )
            ),
            React.createElement(
              Text,
              { color: colorPalettes.dust.tertiary },
              `  ... and ${instances.length - 5} more`
            )
          ),
          React.createElement(ConfirmInput, {
            message: `Migrate all ${instances.length} instances?`,
            onConfirm: () => {
              onComplete({
                instances,
                mode,
                totalSelected: instances.length,
                totalAvailable: instances.length
              });
            },
            onCancel: () => {
              setError('Selection cancelled. Going back to input.');
              setCurrentStep('input');
            }
          })
        )
      ),
      error && React.createElement(
        StatusMessage,
        { variant: 'error' },
        error
      ),
      React.createElement(
        Text,
        { color: '#ac8500' },
        instances.length <= 20 
          ? 'Use Space to select/deselect, Enter to confirm, Esc to go back'
          : 'Esc to go back'
      )
    );
  };

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    loading ? (
      React.createElement(
        StatusMessage,
        { variant: 'info' },
        'Loading instances...'
      )
    ) : (
      renderStep()
    )
  );
};

export default InstanceSelector;