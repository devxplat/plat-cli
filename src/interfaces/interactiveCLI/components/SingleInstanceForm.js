import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput, PasswordInput, Select } from '@inkjs/ui';
import { colorPalettes } from '../theme/custom-theme.js';

/**
 * SingleInstanceForm Component
 * Unified form for single instance migration with inline credentials
 */
const SingleInstanceForm = ({
  onComplete,
  onCancel,
  initialData = {},
  label = 'Configure Migration'
}) => {
  // Form state with initial values
  const [formData, setFormData] = useState({
    sourceProject: initialData.sourceProject || '',
    sourceInstance: initialData.sourceInstance || '',
    sourceUser: initialData.sourceUser || 'postgres',
    sourcePassword: initialData.sourcePassword || '',
    targetProject: initialData.targetProject || '',
    targetInstance: initialData.targetInstance || '',
    targetUser: initialData.targetUser || 'postgres',
    targetPassword: initialData.targetPassword || '',
    credentialsMode: initialData.credentialsMode || 'individual'
  });

  const [currentField, setCurrentField] = useState('sourceProject');
  const [editingField, setEditingField] = useState(null);
  const [error, setError] = useState(null);

  // Field order for navigation
  const fieldOrder = [
    'sourceProject', 'sourceInstance',
    ...(formData.credentialsMode === 'individual' ? ['sourceUser', 'sourcePassword'] : []),
    'targetProject', 'targetInstance',
    ...(formData.credentialsMode === 'individual' ? ['targetUser', 'targetPassword'] : []),
    'credentialsMode',
    ...(formData.credentialsMode === 'same' ? ['sameUser', 'samePassword'] : [])
  ];

  // Handle keyboard navigation
  useInput((input, key) => {
    if (key.escape) {
      if (editingField) {
        // Just exit editing mode, stay on the same screen
        setEditingField(null);
        return;
      } else {
        // Only go back if not editing
        // Save current state before going back
        onCancel?.(formData);
        return;
      }
    }

    // Don't process navigation when editing
    if (editingField) return;

    // Tab navigation
    if (key.tab && !key.shift) {
      const currentIdx = fieldOrder.indexOf(currentField);
      const nextIdx = (currentIdx + 1) % fieldOrder.length;
      setCurrentField(fieldOrder[nextIdx]);
    }

    if (key.tab && key.shift) {
      const currentIdx = fieldOrder.indexOf(currentField);
      const prevIdx = currentIdx > 0 ? currentIdx - 1 : fieldOrder.length - 1;
      setCurrentField(fieldOrder[prevIdx]);
    }

    // Arrow key navigation
    if (key.upArrow) {
      const currentIdx = fieldOrder.indexOf(currentField);
      const prevIdx = currentIdx > 0 ? currentIdx - 1 : fieldOrder.length - 1;
      setCurrentField(fieldOrder[prevIdx]);
    }

    if (key.downArrow) {
      const currentIdx = fieldOrder.indexOf(currentField);
      const nextIdx = (currentIdx + 1) % fieldOrder.length;
      setCurrentField(fieldOrder[nextIdx]);
    }

    // Enter to edit or submit
    if (key.return) {
      if (currentField === 'credentialsMode') {
        // Cycle through modes
        const modes = ['individual', 'same', 'env'];
        const currentIdx = modes.indexOf(formData.credentialsMode);
        const nextIdx = (currentIdx + 1) % modes.length;
        setFormData({ ...formData, credentialsMode: modes[nextIdx] });
      } else if (fieldOrder.includes(currentField)) {
        setEditingField(currentField);
      }
    }

    // Ctrl+S to submit
    if (key.ctrl && input === 's') {
      handleSubmit();
    }

    // Ctrl+A to toggle credentials mode
    if (key.ctrl && input === 'a') {
      const modes = ['individual', 'same', 'env'];
      const currentIdx = modes.indexOf(formData.credentialsMode);
      const nextIdx = (currentIdx + 1) % modes.length;
      setFormData({ ...formData, credentialsMode: modes[nextIdx] });
    }
  });

  // Handle field update
  const handleFieldUpdate = (field, value) => {
    setFormData({ ...formData, [field]: value });
    setEditingField(null);
    setError(null);
  };

  // Handle submission
  const handleSubmit = () => {
    // Validate required fields
    const requiredFields = ['sourceProject', 'sourceInstance', 'targetProject', 'targetInstance'];
    
    for (const field of requiredFields) {
      if (!formData[field]) {
        setError(`${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is required`);
        setCurrentField(field);
        return;
      }
    }

    // Validate credentials based on mode
    if (formData.credentialsMode === 'individual') {
      if (!formData.sourceUser || !formData.sourcePassword) {
        setError('Source credentials are required');
        setCurrentField('sourceUser');
        return;
      }
      if (!formData.targetUser || !formData.targetPassword) {
        setError('Target credentials are required');
        setCurrentField('targetUser');
        return;
      }
    } else if (formData.credentialsMode === 'same') {
      if (!formData.sameUser || !formData.samePassword) {
        setError('Credentials are required');
        setCurrentField('sameUser');
        return;
      }
    }

    // Prepare result
    const result = {
      source: {
        project: formData.sourceProject,
        instance: formData.sourceInstance,
        credentials: formData.credentialsMode === 'individual' 
          ? { user: formData.sourceUser, password: formData.sourcePassword }
          : formData.credentialsMode === 'same'
          ? { user: formData.sameUser || 'postgres', password: formData.samePassword }
          : { user: process.env.PGUSER_SOURCE || 'postgres', password: process.env.PGPASSWORD_SOURCE }
      },
      target: {
        project: formData.targetProject,
        instance: formData.targetInstance,
        credentials: formData.credentialsMode === 'individual'
          ? { user: formData.targetUser, password: formData.targetPassword }
          : formData.credentialsMode === 'same'
          ? { user: formData.sameUser || 'postgres', password: formData.samePassword }
          : { user: process.env.PGUSER_TARGET || 'postgres', password: process.env.PGPASSWORD_TARGET }
      },
      credentialsMode: formData.credentialsMode,
      formData // Include raw form data for navigation
    };

    onComplete(result);
  };

  // Render field
  const renderField = (fieldName, label, isPassword = false) => {
    const isFocused = currentField === fieldName;
    const isEditing = editingField === fieldName;
    const value = formData[fieldName] || '';

    if (isEditing) {
      if (isPassword) {
        return React.createElement(PasswordInput, {
          onSubmit: (val) => handleFieldUpdate(fieldName, val)
        });
      } else {
        return React.createElement(TextInput, {
          defaultValue: value,
          onSubmit: (val) => handleFieldUpdate(fieldName, val)
        });
      }
    }

    return React.createElement(
      Text,
      {
        color: isFocused ? 'cyan' : 'white',
        underline: isFocused
      },
      `[${isPassword && value ? '*'.repeat(8) : value.padEnd(15, ' ')}]`
    );
  };

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    // Header
    React.createElement(
      Text,
      { color: colorPalettes.dust.primary, bold: true },
      `⚙️ ${label}`
    ),

    // Credentials mode selector (moved to top)
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.dust.secondary },
        'Credentials Mode: '
      ),
      React.createElement(
        Text,
        {
          color: currentField === 'credentialsMode' ? 'cyan' : 'white',
          underline: currentField === 'credentialsMode'
        },
        `[${formData.credentialsMode === 'same' ? 'Same for Both' :
           formData.credentialsMode === 'individual' ? 'Individual' :
           'From Environment'} ▼]`
      )
    ),

    // Same credentials input if mode is 'same'
    formData.credentialsMode === 'same' && React.createElement(
      Box,
      { flexDirection: 'column', marginLeft: 2, marginTop: 1 },
      React.createElement(
        Box,
        null,
        React.createElement(Text, { color: 'gray' }, 'User:     '),
        renderField('sameUser', 'Same User')
      ),
      React.createElement(
        Box,
        null,
        React.createElement(Text, { color: 'gray' }, 'Password: '),
        renderField('samePassword', 'Same Password', true)
      )
    ),

    // Source configuration
    React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.dust.secondary, bold: true },
        '🔍 Source Configuration:'
      ),
      React.createElement(
        Box,
        { marginLeft: 2 },
        React.createElement(Text, { color: 'gray' }, 'Project:  '),
        renderField('sourceProject', 'Source Project')
      ),
      React.createElement(
        Box,
        { marginLeft: 2 },
        React.createElement(Text, { color: 'gray' }, 'Instance: '),
        renderField('sourceInstance', 'Source Instance')
      ),
      formData.credentialsMode === 'individual' && React.createElement(
        Box,
        { marginLeft: 2 },
        React.createElement(Text, { color: 'gray' }, 'User:     '),
        renderField('sourceUser', 'Source User')
      ),
      formData.credentialsMode === 'individual' && React.createElement(
        Box,
        { marginLeft: 2 },
        React.createElement(Text, { color: 'gray' }, 'Password: '),
        renderField('sourcePassword', 'Source Password', true)
      ),
      formData.credentialsMode === 'env' && React.createElement(
        Text,
        { color: 'gray', marginLeft: 2, dimColor: true },
        '└─ Using env vars: PGUSER_SOURCE & PGPASSWORD_SOURCE'
      )
    ),

    // Target configuration
    React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.dust.secondary, bold: true },
        '🎯 Target Configuration:'
      ),
      React.createElement(
        Box,
        { marginLeft: 2 },
        React.createElement(Text, { color: 'gray' }, 'Project:  '),
        renderField('targetProject', 'Target Project')
      ),
      React.createElement(
        Box,
        { marginLeft: 2 },
        React.createElement(Text, { color: 'gray' }, 'Instance: '),
        renderField('targetInstance', 'Target Instance')
      ),
      formData.credentialsMode === 'individual' && React.createElement(
        Box,
        { marginLeft: 2 },
        React.createElement(Text, { color: 'gray' }, 'User:     '),
        renderField('targetUser', 'Target User')
      ),
      formData.credentialsMode === 'individual' && React.createElement(
        Box,
        { marginLeft: 2 },
        React.createElement(Text, { color: 'gray' }, 'Password: '),
        renderField('targetPassword', 'Target Password', true)
      ),
      formData.credentialsMode === 'env' && React.createElement(
        Text,
        { color: 'gray', marginLeft: 2, dimColor: true },
        '└─ Using env vars: PGUSER_TARGET & PGPASSWORD_TARGET'
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
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(
        Text,
        { color: 'green', dimColor: true },
        'Press Ctrl+S to save and continue'
      )
    ),

    // Navigation hints (moved to bottom)
    React.createElement(
      Text,
      { color: colorPalettes.dust.tertiary, marginTop: 1 },
      '💡 Tab/↑↓: navigate • Enter: edit • Ctrl+S: submit • Ctrl+A: toggle mode'
    )
  );
};

export default SingleInstanceForm;