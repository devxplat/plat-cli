import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  PasswordInput,
  TextInput,
  Select,
  StatusMessage
} from '@inkjs/ui';
import SimpleSelect from './SimpleSelect.js';
import { colorPalettes } from '../theme/custom-theme.js';

/**
 * CredentialsConfiguration Component
 * Handles user and password configuration for CloudSQL migrations
 */
const CredentialsConfiguration = ({ 
  instances = [],
  onComplete,
  onCancel,
  allowMultiple = true,
  migrationMode = 'single'
}) => {
  const [credentialsMode, setCredentialsMode] = useState(null); // 'same', 'source-target', 'individual', 'env'
  const [credentials, setCredentials] = useState({});
  const [currentInstanceIndex, setCurrentInstanceIndex] = useState(0);
  const [currentUser, setCurrentUser] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState('mode'); // mode, input-user, input-password, confirm
  const [inputType, setInputType] = useState('source'); // source, target, all

  // Get unique instances (deduplicate by project:instance)
  const uniqueInstances = instances.reduce((acc, inst) => {
    const key = `${inst.project}:${inst.instance}`;
    if (!acc.find(i => `${i.project}:${i.instance}` === key)) {
      acc.push(inst);
    }
    return acc;
  }, []);

  // Determine if we have source and target instances
  const hasSourceAndTarget = instances.some(inst => inst.isSource) && instances.some(inst => !inst.isSource);

  // Handle keyboard navigation
  useInput((input, key) => {
    if (key.escape) {
      if (currentStep !== 'mode') {
        setCurrentStep('mode');
        setError(null);
        setCredentials({});
        setCurrentInstanceIndex(0);
        setCurrentUser('');
        setCurrentPassword('');
      } else {
        onCancel?.();
      }
    }
  });

  // Handle credentials mode selection
  const handleModeSelection = (mode) => {
    setCredentialsMode(mode);
    
    if (mode === 'env') {
      // Use environment variables
      const envCredentials = {
        mode: 'env',
        credentials: {}
      };

      if (mode === 'env' && hasSourceAndTarget) {
        envCredentials.credentials.source = {
          user: 'PGUSER_SOURCE',
          password: 'PGPASSWORD_SOURCE'
        };
        envCredentials.credentials.target = {
          user: 'PGUSER_TARGET',
          password: 'PGPASSWORD_TARGET'
        };
      } else {
        uniqueInstances.forEach(inst => {
          const key = `${inst.project}:${inst.instance}`;
          const envUserVar = `PGUSER_${inst.instance.toUpperCase().replace(/-/g, '_')}`;
          const envPassVar = `PGPASSWORD_${inst.instance.toUpperCase().replace(/-/g, '_')}`;
          envCredentials.credentials[key] = {
            user: envUserVar,
            password: envPassVar
          };
        });
      }
      
      onComplete({
        ...envCredentials,
        message: 'Using environment variables for credentials'
      });
    } else {
      setCurrentStep('input-user');
      if (mode === 'source-target') {
        setInputType('source');
      } else {
        setInputType('all');
      }
    }
  };

  // Handle user input submission
  const handleUserSubmit = (username) => {
    if (!username || username.trim().length === 0) {
      setError('Username cannot be empty');
      return;
    }

    if (username.trim() === 'postgres' && currentStep === 'input-user') {
      setError('⚠️ Using "postgres" user is not recommended for production');
    }

    setCurrentUser(username.trim());
    setCurrentStep('input-password');
    setError(null);
  };

  // Handle password submission
  const handlePasswordSubmit = (password) => {
    if (!password || password.trim().length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    const userPass = {
      user: currentUser,
      password: password.trim()
    };

    if (credentialsMode === 'same') {
      // Same credentials for all
      const sameCredentials = {};
      uniqueInstances.forEach(inst => {
        const key = `${inst.project}:${inst.instance}`;
        sameCredentials[key] = userPass;
      });
      setCredentials({
        mode: 'same',
        credentials: { all: userPass }
      });
      setCurrentStep('confirm');
    } else if (credentialsMode === 'source-target') {
      // Different credentials for source and target
      const updatedCreds = { ...credentials };
      if (!updatedCreds.credentials) {
        updatedCreds.credentials = {};
      }
      
      updatedCreds.credentials[inputType] = userPass;
      
      if (inputType === 'source' && !updatedCreds.credentials.target) {
        // Move to target input
        setInputType('target');
        setCurrentStep('input-user');
        setCurrentUser('');
        setCurrentPassword('');
        setError(null);
        setCredentials(updatedCreds);
      } else {
        // Both source and target are set
        setCredentials({
          mode: 'source-target',
          credentials: updatedCreds.credentials
        });
        setCurrentStep('confirm');
      }
    } else if (credentialsMode === 'individual') {
      // Individual credentials per instance
      const currentInstance = uniqueInstances[currentInstanceIndex];
      const key = `${currentInstance.project}:${currentInstance.instance}`;
      
      const updatedCreds = { ...credentials };
      if (!updatedCreds.credentials) {
        updatedCreds.credentials = {};
      }
      
      updatedCreds.credentials[key] = userPass;
      
      // Move to next instance or complete
      if (currentInstanceIndex < uniqueInstances.length - 1) {
        setCurrentInstanceIndex(currentInstanceIndex + 1);
        setCurrentStep('input-user');
        setCurrentUser('');
        setCurrentPassword('');
        setError(null);
        setCredentials(updatedCreds);
      } else {
        setCredentials({
          mode: 'individual',
          credentials: updatedCreds.credentials
        });
        setCurrentStep('confirm');
      }
    }
  };

  // Handle confirmation
  const handleConfirm = () => {
    onComplete({
      ...credentials,
      message: `Configured credentials using ${credentialsMode} mode`
    });
  };

  // Render based on current step
  const renderContent = () => {
    switch (currentStep) {
      case 'mode':
        const modeOptions = [
          { label: 'Use same credentials for all connections', value: 'same' }
        ];
        
        if (hasSourceAndTarget || migrationMode !== 'batch') {
          modeOptions.push({ label: 'Use different credentials for source and target', value: 'source-target' });
        }
        
        if (uniqueInstances.length > 1 && migrationMode === 'batch') {
          modeOptions.push({ label: 'Use different credentials for each instance', value: 'individual' });
        }
        
        modeOptions.push({ label: 'Use environment variables', value: 'env' });

        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1 },
          React.createElement(
            Text,
            { color: colorPalettes.dust.primary },
            `🔐 Credentials Configuration (${uniqueInstances.length} instance${uniqueInstances.length > 1 ? 's' : ''}):`
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

      case 'input-user':
        let userLabel = '👤 Enter username:';
        if (credentialsMode === 'source-target') {
          userLabel = inputType === 'source' ? '👤 Enter SOURCE username:' : '👤 Enter TARGET username:';
        } else if (credentialsMode === 'individual') {
          const currentInstance = uniqueInstances[currentInstanceIndex];
          userLabel = `👤 Username for ${currentInstance.instance} (${currentInstanceIndex + 1}/${uniqueInstances.length}):`;
        }

        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1 },
          React.createElement(
            Text,
            { color: colorPalettes.dust.primary },
            userLabel
          ),
          credentialsMode === 'individual' && React.createElement(
            Text,
            { color: colorPalettes.dust.secondary },
            `${uniqueInstances[currentInstanceIndex].project}:${uniqueInstances[currentInstanceIndex].instance}`
          ),
          React.createElement(TextInput, {
            placeholder: 'Enter username (e.g., dbuser)...',
            defaultValue: currentUser || 'postgres',
            onSubmit: handleUserSubmit
          }),
          error && React.createElement(
            StatusMessage,
            { variant: error.includes('⚠️') ? 'warning' : 'error' },
            error
          ),
          React.createElement(
            Text,
            { color: colorPalettes.dust.tertiary },
            'Default: postgres (press Enter to use default)'
          )
        );

      case 'input-password':
        let passwordLabel = '🔑 Enter password:';
        if (credentialsMode === 'source-target') {
          passwordLabel = inputType === 'source' ? '🔑 Enter SOURCE password:' : '🔑 Enter TARGET password:';
        } else if (credentialsMode === 'individual') {
          const currentInstance = uniqueInstances[currentInstanceIndex];
          passwordLabel = `🔑 Password for ${currentInstance.instance} (${currentInstanceIndex + 1}/${uniqueInstances.length}):`;
        }

        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1 },
          React.createElement(
            Text,
            { color: colorPalettes.dust.primary },
            passwordLabel
          ),
          React.createElement(
            Text,
            { color: colorPalettes.dust.secondary },
            `User: ${currentUser}`
          ),
          React.createElement(PasswordInput, {
            placeholder: 'Enter password (min 8 characters)...',
            onChange: setCurrentPassword,
            onSubmit: handlePasswordSubmit
          }),
          error && React.createElement(
            StatusMessage,
            { variant: 'error' },
            error
          ),
          credentialsMode === 'individual' && Object.keys(credentials.credentials || {}).length > 0 && React.createElement(
            Box,
            { gap: 1 },
            React.createElement(
              Text,
              { color: 'green' },
              `✓ Configured: ${Object.keys(credentials.credentials || {}).length}`
            ),
            React.createElement(
              Text,
              { color: 'yellow' },
              `⏳ Remaining: ${uniqueInstances.length - Object.keys(credentials.credentials || {}).length}`
            )
          )
        );

      case 'confirm':
        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1 },
          React.createElement(
            Text,
            { color: colorPalettes.dust.primary, bold: true },
            '📋 Credentials Configuration Summary:'
          ),
          React.createElement(
            Box,
            { flexDirection: 'column', marginTop: 1 },
            React.createElement(
              Text,
              { color: 'green' },
              `✓ Mode: ${credentialsMode === 'same' ? 'Same credentials' : 
                         credentialsMode === 'source-target' ? 'Source/Target credentials' :
                         credentialsMode === 'individual' ? 'Individual credentials' : 
                         'Environment variables'}`
            )
          ),

          credentialsMode === 'same' && credentials.credentials?.all && React.createElement(
            Box,
            { flexDirection: 'column', marginTop: 1 },
            React.createElement(
              Text,
              { color: colorPalettes.dust.secondary },
              `User: ${credentials.credentials.all.user}`
            ),
            React.createElement(
              Text,
              { color: colorPalettes.dust.secondary },
              `Password: ${'*'.repeat(8)}`
            )
          ),

          credentialsMode === 'source-target' && React.createElement(
            Box,
            { flexDirection: 'column', marginTop: 1 },
            React.createElement(
              Text,
              { color: colorPalettes.dust.secondary },
              'Source credentials:'
            ),
            React.createElement(
              Text,
              { color: 'gray' },
              `  User: ${credentials.credentials?.source?.user}`
            ),
            React.createElement(
              Text,
              { color: 'gray' },
              `  Password: ${'*'.repeat(8)}`
            ),
            React.createElement(
              Text,
              { color: colorPalettes.dust.secondary },
              'Target credentials:'
            ),
            React.createElement(
              Text,
              { color: 'gray' },
              `  User: ${credentials.credentials?.target?.user}`
            ),
            React.createElement(
              Text,
              { color: 'gray' },
              `  Password: ${'*'.repeat(8)}`
            )
          ),

          credentialsMode === 'individual' && React.createElement(
            Box,
            { flexDirection: 'column', marginTop: 1 },
            React.createElement(
              Text,
              { color: colorPalettes.dust.secondary },
              'Configured instances:'
            ),
            ...Object.entries(credentials.credentials || {}).slice(0, 5).map(([key, cred]) =>
              React.createElement(
                Text,
                { key, color: 'gray' },
                `  • ${key.split(':')[1]} - User: ${cred.user}`
              )
            ),
            Object.keys(credentials.credentials || {}).length > 5 && React.createElement(
              Text,
              { color: colorPalettes.dust.tertiary },
              `  ... and ${Object.keys(credentials.credentials || {}).length - 5} more`
            )
          ),

          React.createElement(
            Box,
            { marginTop: 1, flexDirection: 'column', gap: 1 },
            React.createElement(SimpleSelect, {
              options: [
                { label: '✅ Confirm configuration', value: 'confirm' },
                { label: '❌ Reconfigure credentials', value: 'reconfigure' }
              ],
              defaultValue: 'confirm',
              onSubmit: (value) => {
                if (value === 'confirm') {
                  handleConfirm();
                } else {
                  setCurrentStep('mode');
                  setCredentials({});
                  setCurrentInstanceIndex(0);
                  setCurrentUser('');
                  setCurrentPassword('');
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

export default CredentialsConfiguration;