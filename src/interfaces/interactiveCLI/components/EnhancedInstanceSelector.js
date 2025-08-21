import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useFocus, useFocusManager } from 'ink';
import { TextInput, PasswordInput, Select } from '@inkjs/ui';
import { colorPalettes } from '../theme/custom-theme.js';

/**
 * EnhancedInstanceSelector Component
 * Unified instance selection with inline credential configuration
 */
const EnhancedInstanceSelector = ({
  instances = [],
  onSubmit,
  onCancel,
  allowMultiple = true,
  label = 'Select CloudSQL Instances',
  isSource = true,
  initialSelections = [],
  initialCredentials = {},
  initialCredentialsMode = 'individual'
}) => {
  // Initialize with provided initial state or defaults
  const [selectedInstances, setSelectedInstances] = useState(() => {
    if (initialSelections && initialSelections.length > 0) {
      return new Set(initialSelections.map(inst => `${inst.project}:${inst.instance}`));
    }
    return new Set();
  });
  const [credentials, setCredentials] = useState(initialCredentials);
  const [credentialsMode, setCredentialsMode] = useState(initialCredentialsMode);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [focusedField, setFocusedField] = useState('checkbox'); // 'checkbox', 'user', 'password', 'mode'
  const [error, setError] = useState(null);
  const [showCredentials, setShowCredentials] = useState(() => {
    // Show credentials for initially selected instances
    const initial = {};
    if (initialSelections && initialSelections.length > 0) {
      initialSelections.forEach(inst => {
        initial[`${inst.project}:${inst.instance}`] = true;
      });
    }
    return initial;
  });
  const [sameCredentials, setSameCredentials] = useState(() => {
    // Initialize same credentials if mode is 'same' and we have initial data
    if (initialCredentialsMode === 'same' && initialCredentials.all) {
      return initialCredentials.all;
    }
    return { user: 'postgres', password: '' };
  });
  const [editingField, setEditingField] = useState(null); // Track which field is being edited
  
  const { enableFocus, disableFocus, focusNext, focusPrevious } = useFocusManager();

  // Initialize credentials for instances
  useEffect(() => {
    // Only initialize if we don't have initial credentials
    if (!initialCredentials || Object.keys(initialCredentials).length === 0) {
      const initialCreds = {};
      instances.forEach((inst, idx) => {
        const key = `${inst.project}:${inst.instance}`;
        initialCreds[key] = {
          user: 'postgres',
          password: ''
        };
      });
      setCredentials(initialCreds);
    }
  }, [instances, initialCredentials]);

  // Handle keyboard navigation
  useInput((input, key) => {
    // Handle escape
    if (key.escape) {
      if (editingField) {
        // Just exit editing mode, stay on the same screen
        setEditingField(null);
        return;
      } else {
        // Only go back if not editing
        // Preserve current state when canceling
        const preservedData = {
          project: instances[0]?.project,
          instances: instances.filter(inst => 
            selectedInstances.has(`${inst.project}:${inst.instance}`)
          ).map(inst => ({
            ...inst,
            credentials: credentialsMode === 'same' ? sameCredentials :
                        credentialsMode === 'individual' ? credentials[`${inst.project}:${inst.instance}`] :
                        { user: process.env[`PGUSER_${inst.instance.toUpperCase().replace(/-/g, '_')}`] || 'postgres',
                          password: process.env[`PGPASSWORD_${inst.instance.toUpperCase().replace(/-/g, '_')}`] }
          })),
          credentialsMode,
          totalFound: instances.length,
          totalSelected: selectedInstances.size,
          isSource,
          // Preserve selection state for restoration
          initialSelections: Array.from(selectedInstances).map(key => {
            const [project, instance] = key.split(':');
            return { project, instance };
          }),
          initialCredentials: credentialsMode === 'same' ? { all: sameCredentials } : credentials,
          initialCredentialsMode: credentialsMode
        };
        onCancel?.(preservedData);
        return;
      }
    }

    // Don't process navigation keys when editing
    if (editingField) {
      return;
    }

    // Navigation between instances
    if (key.upArrow) {
      if (focusedIndex > 0) {
        setFocusedIndex(focusedIndex - 1);
        setFocusedField('checkbox');
      }
    }

    if (key.downArrow) {
      if (focusedIndex < instances.length - 1) {
        setFocusedIndex(focusedIndex + 1);
        setFocusedField('checkbox');
      } else if (focusedIndex === instances.length - 1) {
        // Move to credentials mode selector
        setFocusedField('mode');
      }
    }

    // Tab navigation within an instance
    if (key.tab && !key.shift) {
      const currentInstance = instances[focusedIndex];
      const key = `${currentInstance.project}:${currentInstance.instance}`;
      
      if (focusedField === 'checkbox' && selectedInstances.has(key) && credentialsMode === 'individual') {
        setFocusedField('user');
      } else if (focusedField === 'user') {
        setFocusedField('password');
      } else if (focusedField === 'password') {
        if (focusedIndex < instances.length - 1) {
          setFocusedIndex(focusedIndex + 1);
          setFocusedField('checkbox');
        } else {
          setFocusedField('mode');
        }
      } else if (focusedField === 'mode' && credentialsMode === 'same') {
        setFocusedField('same-user');
      } else if (focusedField === 'same-user') {
        setFocusedField('same-password');
      }
    }

    // Shift+Tab for backward navigation
    if (key.tab && key.shift) {
      if (focusedField === 'password') {
        setFocusedField('user');
      } else if (focusedField === 'user') {
        setFocusedField('checkbox');
      } else if (focusedField === 'mode' && focusedIndex > 0) {
        setFocusedIndex(focusedIndex - 1);
        const prevInstance = instances[focusedIndex - 1];
        const prevKey = `${prevInstance.project}:${prevInstance.instance}`;
        if (selectedInstances.has(prevKey) && credentialsMode === 'individual') {
          setFocusedField('password');
        } else {
          setFocusedField('checkbox');
        }
      } else if (focusedField === 'same-password') {
        setFocusedField('same-user');
      } else if (focusedField === 'same-user') {
        setFocusedField('mode');
      }
    }

    // Space to toggle selection
    if (input === ' ' && focusedField === 'checkbox') {
      const currentInstance = instances[focusedIndex];
      const key = `${currentInstance.project}:${currentInstance.instance}`;
      
      const newSelected = new Set(selectedInstances);
      const newShowCreds = { ...showCredentials };
      
      if (newSelected.has(key)) {
        newSelected.delete(key);
        delete newShowCreds[key];
      } else {
        newSelected.add(key);
        newShowCreds[key] = true;
      }
      
      setSelectedInstances(newSelected);
      setShowCredentials(newShowCreds);
      setError(null); // Clear error on selection change
    }

    // Enter to edit field or submit
    if (key.return) {
      if (focusedField === 'user' || focusedField === 'password' || 
          focusedField === 'same-user' || focusedField === 'same-password') {
        setEditingField(focusedField);
      } else if (focusedField === 'checkbox' || focusedField === 'mode') {
        // Try to submit if we're not on an editable field
        handleSubmit();
      }
    }

    // Ctrl+A to toggle credentials mode
    if (key.ctrl && input === 'a') {
      const modes = ['individual', 'same', 'env'];
      const currentIdx = modes.indexOf(credentialsMode);
      const nextIdx = (currentIdx + 1) % modes.length;
      setCredentialsMode(modes[nextIdx]);
    }
  });

  // Handle credential input
  const handleCredentialChange = (instanceKey, field, value) => {
    if (credentialsMode === 'same') {
      setSameCredentials({
        ...sameCredentials,
        [field]: value
      });
    } else {
      setCredentials({
        ...credentials,
        [instanceKey]: {
          ...credentials[instanceKey],
          [field]: value
        }
      });
    }
  };

  // Handle submission
  const handleSubmit = () => {
    // Validate selection
    if (selectedInstances.size === 0) {
      setError('Please select at least one instance');
      return;
    }

    // Validate credentials based on mode
    if (credentialsMode === 'same') {
      if (!sameCredentials.user || !sameCredentials.password) {
        setError('Please provide username and password');
        return;
      }
    } else if (credentialsMode === 'individual') {
      for (const key of selectedInstances) {
        if (!credentials[key]?.user || !credentials[key]?.password) {
          setError('Please provide credentials for all selected instances');
          return;
        }
      }
    }

    // Prepare result
    const selectedWithCredentials = instances
      .filter(inst => selectedInstances.has(`${inst.project}:${inst.instance}`))
      .map(inst => {
        const key = `${inst.project}:${inst.instance}`;
        let creds;
        
        if (credentialsMode === 'same') {
          creds = sameCredentials;
        } else if (credentialsMode === 'env') {
          creds = {
            user: process.env[`PGUSER_${inst.instance.toUpperCase().replace(/-/g, '_')}`] || 'postgres',
            password: process.env[`PGPASSWORD_${inst.instance.toUpperCase().replace(/-/g, '_')}`] || ''
          };
        } else {
          creds = credentials[key];
        }
        
        return {
          ...inst,
          credentials: creds
        };
      });

    onSubmit({
      project: instances[0]?.project,
      instances: selectedWithCredentials,
      credentialsMode,
      totalFound: instances.length,
      totalSelected: selectedInstances.size,
      isSource
    });
  };

  // Render credential input fields
  const renderCredentialFields = (instanceKey, instance) => {
    if (credentialsMode === 'env') {
      return React.createElement(
        Box,
        { marginLeft: 4, flexDirection: 'column' },
        React.createElement(
          Text,
          { color: 'gray', dimColor: true },
          `└─ Will use env vars: PGUSER_${instance.instance.toUpperCase().replace(/-/g, '_')} & PGPASSWORD_${instance.instance.toUpperCase().replace(/-/g, '_')}`
        )
      );
    }

    if (credentialsMode === 'same') {
      return null; // Credentials shown at bottom
    }

    const creds = credentials[instanceKey] || { user: 'postgres', password: '' };
    const isFocused = instances[focusedIndex] && 
                     `${instances[focusedIndex].project}:${instances[focusedIndex].instance}` === instanceKey;

    return React.createElement(
      Box,
      { marginLeft: 4 },
      React.createElement(Text, { color: 'gray' }, '└─ User: '),
      editingField === 'user' && isFocused
        ? React.createElement(TextInput, {
            defaultValue: creds.user,
            onSubmit: (value) => {
              handleCredentialChange(instanceKey, 'user', value);
              setEditingField(null);
            }
          })
        : React.createElement(
            Text,
            { 
              color: focusedField === 'user' && isFocused ? 'cyan' : 'white',
              underline: focusedField === 'user' && isFocused
            },
            `[${creds.user || 'postgres'}]`
          ),
      React.createElement(Text, { color: 'gray' }, ' Password: '),
      editingField === 'password' && isFocused
        ? React.createElement(PasswordInput, {
            onSubmit: (value) => {
              handleCredentialChange(instanceKey, 'password', value);
              setEditingField(null);
            }
          })
        : React.createElement(
            Text,
            { 
              color: focusedField === 'password' && isFocused ? 'cyan' : 'white',
              underline: focusedField === 'password' && isFocused
            },
            `[${creds.password ? '*'.repeat(8) : '        '}]`
          )
    );
  };

  // Group instances by version
  const versionGroups = {};
  instances.forEach(inst => {
    const version = inst.version || 'Unknown';
    if (!versionGroups[version]) {
      versionGroups[version] = [];
    }
    versionGroups[version].push(inst);
  });

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    // Header
    React.createElement(
      Text,
      { color: colorPalettes.dust.primary, bold: true },
      `🔧 ${label} (${instances.length} found):`
    ),

    // Version distribution
    Object.keys(versionGroups).length > 1 && React.createElement(
      Box,
      { flexDirection: 'column', marginBottom: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.dust.secondary },
        'PostgreSQL versions:'
      ),
      ...Object.entries(versionGroups).map(([version, insts]) =>
        React.createElement(
          Text,
          { key: version, color: 'gray' },
          `  • PG ${version}: ${insts.length} instance${insts.length > 1 ? 's' : ''}`
        )
      )
    ),

    // Navigation hints
    React.createElement(
      Text,
      { color: colorPalettes.dust.tertiary },
      '💡 Space: select • Tab: navigate fields • Enter: edit/confirm • Ctrl+A: toggle mode'
    ),

    // Instance list
    React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 1 },
      ...instances.map((instance, idx) => {
        const key = `${instance.project}:${instance.instance}`;
        const isSelected = selectedInstances.has(key);
        const isFocused = idx === focusedIndex;
        
        return React.createElement(
          Box,
          { key, flexDirection: 'column' },
          React.createElement(
            Box,
            null,
            React.createElement(
              Text,
              { 
                color: isFocused && focusedField === 'checkbox' ? 'cyan' : 'white',
                bold: isFocused && focusedField === 'checkbox'
              },
              `[${isSelected ? '✓' : ' '}] ${instance.label || instance.instance}`
            )
          ),
          isSelected && showCredentials[key] && renderCredentialFields(key, instance)
        );
      })
    ),

    // Credentials mode selector
    React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 1, gap: 1 },
      React.createElement(
        Box,
        null,
        React.createElement(
          Text,
          { color: colorPalettes.dust.secondary },
          'Credentials Mode: '
        ),
        React.createElement(
          Text,
          { 
            color: focusedField === 'mode' ? 'cyan' : 'white',
            underline: focusedField === 'mode'
          },
          `[${credentialsMode === 'same' ? 'Same for All' : 
             credentialsMode === 'individual' ? 'Individual' : 
             'From Environment'} ▼]`
        )
      ),

      // Show same credentials input if mode is 'same'
      credentialsMode === 'same' && selectedInstances.size > 0 && React.createElement(
        Box,
        { marginLeft: 2 },
        React.createElement(Text, { color: 'gray' }, 'User: '),
        editingField === 'same-user'
          ? React.createElement(TextInput, {
              defaultValue: sameCredentials.user,
              onSubmit: (value) => {
                setSameCredentials({ ...sameCredentials, user: value });
                setEditingField(null);
              }
            })
          : React.createElement(
              Text,
              { 
                color: focusedField === 'same-user' ? 'cyan' : 'white',
                underline: focusedField === 'same-user'
              },
              `[${sameCredentials.user}]`
            ),
        React.createElement(Text, { color: 'gray' }, ' Password: '),
        editingField === 'same-password'
          ? React.createElement(PasswordInput, {
              onSubmit: (value) => {
                setSameCredentials({ ...sameCredentials, password: value });
                setEditingField(null);
              }
            })
          : React.createElement(
              Text,
              { 
                color: focusedField === 'same-password' ? 'cyan' : 'white',
                underline: focusedField === 'same-password'
              },
              `[${sameCredentials.password ? '*'.repeat(8) : '        '}]`
            )
      )
    ),

    // Error message
    error && React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(
        Text,
        { color: 'red' },
        `❌ ${error}`
      )
    ),

    // Submit hint
    selectedInstances.size > 0 && React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(
        Text,
        { color: 'green' },
        `✓ ${selectedInstances.size} instance${selectedInstances.size > 1 ? 's' : ''} selected. Press Enter to continue.`
      )
    )
  );
};

export default EnhancedInstanceSelector;