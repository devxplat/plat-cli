import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  PasswordInput,
  Select,
  StatusMessage
} from '@inkjs/ui';
import SimpleSelect from './SimpleSelect.js';
import { colorPalettes } from '../theme/custom-theme.js';

/**
 * PasswordConfiguration Component
 * Handles password configuration for CloudSQL migrations
 */
const PasswordConfiguration = ({ 
  instances = [],
  onComplete,
  onCancel,
  allowMultiple = true
}) => {
  const [passwordMode, setPasswordMode] = useState(null); // 'single', 'multiple', 'env'
  const [passwords, setPasswords] = useState({});
  const [currentInstanceIndex, setCurrentInstanceIndex] = useState(0);
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState('mode'); // mode, input, confirm

  // Get unique instances (deduplicate by project:instance)
  const uniqueInstances = instances.reduce((acc, inst) => {
    const key = `${inst.project}:${inst.instance}`;
    if (!acc.find(i => `${i.project}:${i.instance}` === key)) {
      acc.push(inst);
    }
    return acc;
  }, []);

  // Handle keyboard navigation
  useInput((input, key) => {
    if (key.escape) {
      if (currentStep !== 'mode') {
        setCurrentStep('mode');
        setError(null);
        setPasswords({});
        setCurrentInstanceIndex(0);
      } else {
        onCancel?.();
      }
    }
  });

  // Handle password mode selection
  const handleModeSelection = (mode) => {
    setPasswordMode(mode);
    
    if (mode === 'env') {
      // Use environment variables
      const envPasswords = {};
      uniqueInstances.forEach(inst => {
        const envVarName = `CLOUDSQL_PASSWORD_${inst.instance.toUpperCase().replace(/-/g, '_')}`;
        envPasswords[`${inst.project}:${inst.instance}`] = {
          type: 'env',
          value: envVarName
        };
      });
      
      onComplete({
        mode: 'env',
        passwords: envPasswords,
        message: 'Using environment variables for passwords'
      });
    } else {
      setCurrentStep('input');
    }
  };

  // Handle single password submission
  const handleSinglePasswordSubmit = (password) => {
    if (!password || password.trim().length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    const singlePasswords = {};
    uniqueInstances.forEach(inst => {
      singlePasswords[`${inst.project}:${inst.instance}`] = {
        type: 'single',
        value: password
      };
    });

    setPasswords(singlePasswords);
    setCurrentStep('confirm');
  };

  // Handle multiple password submission
  const handleMultiplePasswordSubmit = (password) => {
    if (!password || password.trim().length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    const currentInstance = uniqueInstances[currentInstanceIndex];
    const key = `${currentInstance.project}:${currentInstance.instance}`;
    
    setPasswords({
      ...passwords,
      [key]: {
        type: 'multiple',
        value: password
      }
    });

    // Move to next instance or complete
    if (currentInstanceIndex < uniqueInstances.length - 1) {
      setCurrentInstanceIndex(currentInstanceIndex + 1);
      setCurrentPassword('');
      setError(null);
    } else {
      setCurrentStep('confirm');
    }
  };

  // Handle confirmation
  const handleConfirm = () => {
    onComplete({
      mode: passwordMode,
      passwords,
      message: `Configured ${passwordMode === 'single' ? 'single password' : 'individual passwords'} for ${uniqueInstances.length} instance(s)`
    });
  };

  // Render based on current step
  const renderContent = () => {
    switch (currentStep) {
      case 'mode':
        const modeOptions = [
          { label: 'Use single password for all databases', value: 'single' },
          { label: 'Use different password for each instance', value: 'multiple' },
          { label: 'Use environment variables', value: 'env' }
        ];

        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1 },
          React.createElement(
            Text,
            { color: colorPalettes.dust.primary },
            `🔐 Password Configuration (${uniqueInstances.length} instance${uniqueInstances.length > 1 ? 's' : ''}):`
          ),
          
          uniqueInstances.length > 3 && React.createElement(
            Text,
            { color: colorPalettes.dust.secondary },
            'Instances to configure:'
          ),
          uniqueInstances.length > 3 && React.createElement(
            Box,
            { flexDirection: 'column', marginBottom: 1 },
            ...uniqueInstances.slice(0, 3).map((inst, i) =>
              React.createElement(
                Text,
                { key: i, color: 'gray' },
                `  • ${inst.instance} (${inst.project})`
              )
            ),
            uniqueInstances.length > 3 && React.createElement(
              Text,
              { color: colorPalettes.dust.tertiary },
              `  ... and ${uniqueInstances.length - 3} more`
            )
          ),

          React.createElement(Select, {
            options: modeOptions,
            onChange: handleModeSelection
          })
        );

      case 'input':
        if (passwordMode === 'single') {
          return React.createElement(
            Box,
            { flexDirection: 'column', gap: 1 },
            React.createElement(
              Text,
              { color: colorPalettes.dust.primary },
              '🔑 Enter password for all databases:'
            ),
            React.createElement(PasswordInput, {
              placeholder: 'Enter password (min 8 characters)...',
              onChange: setCurrentPassword,
              onSubmit: handleSinglePasswordSubmit
            }),
            error && React.createElement(
              StatusMessage,
              { variant: 'error' },
              error
            ),
            React.createElement(
              Text,
              { color: colorPalettes.dust.tertiary },
              'This password will be used for all database connections'
            )
          );
        }

        if (passwordMode === 'multiple') {
          const currentInstance = uniqueInstances[currentInstanceIndex];
          
          return React.createElement(
            Box,
            { flexDirection: 'column', gap: 1 },
            React.createElement(
              Text,
              { color: colorPalettes.dust.primary },
              `🔑 Password for instance ${currentInstanceIndex + 1}/${uniqueInstances.length}:`
            ),
            React.createElement(
              Text,
              { color: colorPalettes.dust.secondary },
              `${currentInstance.instance} (${currentInstance.project})`
            ),
            React.createElement(PasswordInput, {
              placeholder: 'Enter password (min 8 characters)...',
              defaultValue: currentPassword,
              onChange: setCurrentPassword,
              onSubmit: handleMultiplePasswordSubmit
            }),
            error && React.createElement(
              StatusMessage,
              { variant: 'error' },
              error
            ),
            React.createElement(
              Box,
              { gap: 1 },
              React.createElement(
                Text,
                { color: 'green' },
                `✓ Configured: ${Object.keys(passwords).length}`
              ),
              React.createElement(
                Text,
                { color: 'yellow' },
                `⏳ Remaining: ${uniqueInstances.length - Object.keys(passwords).length}`
              )
            )
          );
        }

        return null;

      case 'confirm':
        const passwordCount = Object.keys(passwords).length;
        
        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1 },
          React.createElement(
            Text,
            { color: colorPalettes.dust.primary, bold: true },
            '📋 Password Configuration Summary:'
          ),
          React.createElement(
            Box,
            { flexDirection: 'column', marginTop: 1 },
            React.createElement(
              Text,
              { color: 'green' },
              `✓ Mode: ${passwordMode === 'single' ? 'Single password' : 'Individual passwords'}`
            ),
            React.createElement(
              Text,
              { color: 'green' },
              `✓ Instances configured: ${passwordCount}`
            )
          ),

          passwordMode === 'multiple' && React.createElement(
            Box,
            { flexDirection: 'column', marginTop: 1 },
            React.createElement(
              Text,
              { color: colorPalettes.dust.secondary },
              'Configured instances:'
            ),
            ...Object.keys(passwords).slice(0, 5).map(key =>
              React.createElement(
                Text,
                { key, color: 'gray' },
                `  • ${key.split(':')[1]} ✓`
              )
            ),
            Object.keys(passwords).length > 5 && React.createElement(
              Text,
              { color: colorPalettes.dust.tertiary },
              `  ... and ${Object.keys(passwords).length - 5} more`
            )
          ),

          React.createElement(
            Box,
            { marginTop: 1, flexDirection: 'column', gap: 1 },
            React.createElement(SimpleSelect, {
              options: [
                { label: '✅ Confirm configuration', value: 'confirm' },
                { label: '❌ Reconfigure passwords', value: 'reconfigure' }
              ],
              defaultValue: 'confirm',
              onSubmit: (value) => {
                if (value === 'confirm') {
                  handleConfirm();
                } else {
                  setCurrentStep('mode');
                  setPasswords({});
                  setCurrentInstanceIndex(0);
                }
              }
            })
          )
        );

      default:
        return null;
    }
  };

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    renderContent()
  );
};

export default PasswordConfiguration;