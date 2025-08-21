import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useFocus, useFocusManager } from 'ink';
import { TextInput, PasswordInput, Select } from '@inkjs/ui';
import { colorPalettes } from '../theme/custom-theme.js';
import { ShimmerSpinner } from './CustomSpinner.js';

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
  initialCredentialsMode = 'individual',
  cache = null // Pass PersistentCache instance for saving/loading credentials
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
  const [focusedField, setFocusedField] = useState('checkbox'); // 'checkbox', 'user', 'password', 'save', 'mode', 'db-radio-all', 'db-radio-specific', 'db-input'
  const [error, setError] = useState(null);
  const [saveCredentialsState, setSaveCredentialsState] = useState({}); // Track which instances should save credentials
  const [currentStep, setCurrentStep] = useState('instances'); // 'instances', 'databases'
  const [databaseSelection, setDatabaseSelection] = useState('all'); // 'all' or 'specific'
  const [selectedDatabases, setSelectedDatabases] = useState('');
  const [availableDatabases, setAvailableDatabases] = useState([]); // List of databases fetched from instances
  const [selectedDatabasesList, setSelectedDatabasesList] = useState(new Set()); // Selected databases as a Set
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [databaseFocusIndex, setDatabaseFocusIndex] = useState(0);
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

  // Initialize credentials for instances and load saved ones
  useEffect(() => {
    const loadCredentials = async () => {
      const initialCreds = {};
      const saveStates = {};
      
      for (const inst of instances) {
        const key = `${inst.project}:${inst.instance}`;
        
        // Try to load saved credentials if cache is available
        if (cache) {
          const saved = await cache.getCredentials(inst.project, inst.instance);
          if (saved) {
            initialCreds[key] = { user: saved.user, password: saved.password };
            saveStates[key] = saved.saveEnabled;
          } else {
            initialCreds[key] = { user: 'postgres', password: '' };
            saveStates[key] = false;
          }
        } else {
          // No cache, use defaults or provided initial credentials
          initialCreds[key] = initialCredentials[key] || {
            user: 'postgres',
            password: ''
          };
          saveStates[key] = false;
        }
      }
      
      // Only update if we don't have initial credentials
      if (!initialCredentials || Object.keys(initialCredentials).length === 0) {
        setCredentials(initialCreds);
      }
      setSaveCredentialsState(saveStates);
    };
    
    loadCredentials();
  }, [instances, initialCredentials, cache]);

  // Handle keyboard navigation
  useInput((input, key) => {
    // Handle escape
    if (key.escape) {
      if (editingField) {
        // Just exit editing mode, stay on the same screen
        setEditingField(null);
        return;
      } else if (currentStep === 'databases') {
        // Go back to instance selection
        setCurrentStep('instances');
        setFocusedField('mode');
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
                          password: process.env[`PGPASSWORD_${inst.instance.toUpperCase().replace(/-/g, '_')}`] },
            databases: currentStep === 'databases' && databaseSelection === 'specific' ? 
                      selectedDatabases.split(',').map(db => db.trim()).filter(db => db) : 
                      databaseSelection === 'all' ? 'all' : undefined
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

    // Database step navigation
    if (currentStep === 'databases') {
      if (key.upArrow) {
        if (focusedField === 'db-radio-specific') {
          setFocusedField('db-radio-all');
        } else if (focusedField === 'db-radio-all') {
          // Stay at top
        } else if (focusedField.startsWith('db-checkbox-')) {
          const currentIndex = parseInt(focusedField.replace('db-checkbox-', ''));
          if (currentIndex > 0) {
            setFocusedField(`db-checkbox-${currentIndex - 1}`);
          } else {
            setFocusedField('db-radio-specific');
          }
        }
      }
      
      if (key.downArrow) {
        if (focusedField === 'db-radio-all') {
          setFocusedField('db-radio-specific');
        } else if (focusedField === 'db-radio-specific') {
          if (databaseSelection === 'specific' && availableDatabases.length > 0) {
            setFocusedField('db-checkbox-0');
          }
        } else if (focusedField.startsWith('db-checkbox-')) {
          const currentIndex = parseInt(focusedField.replace('db-checkbox-', ''));
          if (currentIndex < availableDatabases.length - 1) {
            setFocusedField(`db-checkbox-${currentIndex + 1}`);
          }
        }
      }
      
      // Space to select radio option or toggle checkbox
      if (input === ' ') {
        if (focusedField === 'db-radio-all') {
          setDatabaseSelection('all');
          setSelectedDatabasesList(new Set()); // Clear selections
        } else if (focusedField === 'db-radio-specific') {
          setDatabaseSelection('specific');
          if (availableDatabases.length > 0) {
            setFocusedField('db-checkbox-0');
          }
        } else if (focusedField.startsWith('db-checkbox-')) {
          const currentIndex = parseInt(focusedField.replace('db-checkbox-', ''));
          const dbName = availableDatabases[currentIndex];
          const newSelected = new Set(selectedDatabasesList);
          
          if (newSelected.has(dbName)) {
            newSelected.delete(dbName);
          } else {
            newSelected.add(dbName);
          }
          
          setSelectedDatabasesList(newSelected);
        }
      }
      
      return; // Don't process other navigation in database step
    }

    // Navigation between instances (only in instances step)
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
        setFocusedField('save'); // Move to save checkbox after password
      } else if (focusedField === 'save') {
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
      if (focusedField === 'save') {
        setFocusedField('password');
      } else if (focusedField === 'password') {
        setFocusedField('user');
      } else if (focusedField === 'user') {
        setFocusedField('checkbox');
      } else if (focusedField === 'mode' && focusedIndex > 0) {
        setFocusedIndex(focusedIndex - 1);
        const prevInstance = instances[focusedIndex - 1];
        const prevKey = `${prevInstance.project}:${prevInstance.instance}`;
        if (selectedInstances.has(prevKey) && credentialsMode === 'individual') {
          setFocusedField('save'); // Go to save checkbox
        } else {
          setFocusedField('checkbox');
        }
      } else if (focusedField === 'same-password') {
        setFocusedField('same-user');
      } else if (focusedField === 'same-user') {
        setFocusedField('mode');
      }
    }

    // Space to toggle selection or save checkbox
    if (input === ' ') {
      if (focusedField === 'checkbox') {
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
      } else if (focusedField === 'save') {
        const currentInstance = instances[focusedIndex];
        const key = `${currentInstance.project}:${currentInstance.instance}`;
        
        setSaveCredentialsState({
          ...saveCredentialsState,
          [key]: !saveCredentialsState[key]
        });
      }
    }

    // Enter to edit field or submit
    if (key.return) {
      if (currentStep === 'instances') {
        if (focusedField === 'user' || focusedField === 'password' || 
            focusedField === 'same-user' || focusedField === 'same-password') {
          setEditingField(focusedField);
        } else if (focusedField === 'checkbox' || focusedField === 'mode') {
          // Move to database selection instead of submitting directly
          handleMoveToDatabase();
        }
      } else if (currentStep === 'databases') {
        // On database step, handle database selection inputs
        if (focusedField === 'db-input') {
          setEditingField('db-input');
        } else {
          handleSubmit();
        }
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

  // Handle moving to database selection step
  const handleMoveToDatabase = async () => {
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

    // Fetch databases from the first selected instance
    setLoadingDatabases(true);
    setCurrentStep('databases');
    setFocusedField('db-radio-all'); // Set initial focus for database step
    setError(null);

    try {
      // Get the first selected instance for database discovery
      const firstInstanceKey = Array.from(selectedInstances)[0];
      const [project, instanceName] = firstInstanceKey.split(':');
      const instance = instances.find(inst => 
        `${inst.project}:${inst.instance}` === firstInstanceKey
      );
      
      if (instance) {
        // Get credentials for this instance
        let creds;
        if (credentialsMode === 'same') {
          creds = sameCredentials;
        } else if (credentialsMode === 'individual') {
          creds = credentials[firstInstanceKey];
        } else {
          creds = {
            user: process.env[`PGUSER_${instance.instance.toUpperCase().replace(/-/g, '_')}`] || 'postgres',
            password: process.env[`PGPASSWORD_${instance.instance.toUpperCase().replace(/-/g, '_')}`] || ''
          };
        }

        // Import and use the database discovery function
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        
        // Build psql command to list databases
        const psqlCommand = `PGPASSWORD="${creds.password}" psql -h ${instance.publicIp || instance.ip} -U ${creds.user} -d postgres -t -c "SELECT datname FROM pg_database WHERE datallowconn = true AND datname NOT IN ('template0', 'template1', 'postgres', 'cloudsqladmin') ORDER BY datname;"`;
        
        try {
          const { stdout } = await execAsync(psqlCommand, { 
            timeout: 10000,
            env: { ...process.env, PGPASSWORD: creds.password }
          });
          
          const databases = stdout
            .split('\n')
            .map(db => db.trim())
            .filter(db => db.length > 0);
          
          setAvailableDatabases(databases);
          
          // If we have databases, default to specific selection
          if (databases.length > 0) {
            setDatabaseSelection('specific');
            setFocusedField('db-checkbox-0');
          }
        } catch (error) {
          // If we can't fetch databases, fall back to manual input
          console.error('Failed to fetch databases:', error.message);
          setAvailableDatabases([]);
          setError('Could not fetch database list. You can still select "all databases" or enter names manually.');
        }
      }
    } catch (error) {
      setError('Failed to fetch databases: ' + error.message);
    } finally {
      setLoadingDatabases(false);
    }
  };

  // Handle submission
  const handleSubmit = async () => {
    // Database validation when on database step
    if (currentStep === 'databases' && databaseSelection === 'specific') {
      if (availableDatabases.length > 0 && selectedDatabasesList.size === 0) {
        setError('Please select at least one database');
        return;
      } else if (availableDatabases.length === 0 && !selectedDatabases.trim()) {
        setError('Please specify database names');
        return;
      }
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

    // Save credentials if requested and cache is available
    if (cache && credentialsMode === 'individual') {
      for (const key of selectedInstances) {
        if (saveCredentialsState[key]) {
          const [project, instance] = key.split(':');
          const creds = credentials[key];
          await cache.saveCredentials(project, instance, creds.user, creds.password, true);
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
        
        // Add databases based on selection
        const instResult = {
          ...inst,
          credentials: creds
        };
        
        // Only add databases for source instances
        if (isSource) {
          if (databaseSelection === 'specific') {
            // Use selected checkboxes if available, otherwise use manual input
            if (availableDatabases.length > 0) {
              instResult.databases = Array.from(selectedDatabasesList);
            } else if (selectedDatabases.trim()) {
              instResult.databases = selectedDatabases.split(',').map(db => db.trim()).filter(db => db);
            }
          } else if (databaseSelection === 'all') {
            instResult.databases = 'all';
          }
        }
        
        return instResult;
      });

    onSubmit({
      project: instances[0]?.project,
      instances: selectedWithCredentials,
      credentialsMode,
      totalFound: instances.length,
      totalSelected: selectedInstances.size,
      isSource,
      databaseSelection: isSource ? databaseSelection : undefined,
      databases: isSource && databaseSelection === 'specific' ? 
                 (availableDatabases.length > 0 ? Array.from(selectedDatabasesList) :
                  selectedDatabases.split(',').map(db => db.trim()).filter(db => db)) : 
                 isSource && databaseSelection === 'all' ? 'all' : undefined
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
              // Move focus to password field after user submission
              setFocusedField('password');
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
              
              // Move focus to next logical element after password submission
              if (focusedIndex < instances.length - 1) {
                // Move to next instance
                setFocusedIndex(focusedIndex + 1);
                setFocusedField('checkbox');
              } else {
                // Last instance, move to credentials mode selector
                setFocusedField('mode');
              }
            }
          })
        : React.createElement(
            Text,
            { 
              color: focusedField === 'password' && isFocused ? 'cyan' : 'white',
              underline: focusedField === 'password' && isFocused
            },
            `[${creds.password ? '*'.repeat(8) : '        '}]`
          ),
      // Add save checkbox
      React.createElement(Text, { color: 'gray' }, ' Save: '),
      React.createElement(
        Text,
        { 
          color: focusedField === 'save' && isFocused ? 'cyan' : 'white',
          underline: focusedField === 'save' && isFocused
        },
        `[${saveCredentialsState[instanceKey] ? '✓' : ' '}]`
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

  // Render database selection step
  if (currentStep === 'databases' && isSource) {
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      // Header
      React.createElement(
        Text,
        { color: colorPalettes.dust.primary, bold: true },
        '🗄️ Database Selection'
      ),
      
      // Loading state
      loadingDatabases && React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(ShimmerSpinner, {
          label: 'Fetching available databases...',
          isVisible: true,
          status: 'running'
        })
      ),
      
      // Selected instances summary
      !loadingDatabases && React.createElement(
        Text,
        { color: colorPalettes.dust.secondary },
        `For ${selectedInstances.size} selected instance${selectedInstances.size > 1 ? 's' : ''}:`
      ),
      
      // Radio options
      !loadingDatabases && React.createElement(
        Box,
        { flexDirection: 'column', marginTop: 1, gap: 0 },
        React.createElement(
          Box,
          null,
          React.createElement(
            Text,
            { 
              color: focusedField === 'db-radio-all' || databaseSelection === 'all' ? 'cyan' : 'white',
              bold: databaseSelection === 'all'
            },
            `[${databaseSelection === 'all' ? '●' : '○'}] Migrate all databases`
          )
        ),
        React.createElement(
          Box,
          null,
          React.createElement(
            Text,
            { 
              color: focusedField === 'db-radio-specific' || databaseSelection === 'specific' ? 'cyan' : 'white',
              bold: databaseSelection === 'specific'
            },
            `[${databaseSelection === 'specific' ? '●' : '○'}] Migrate specific databases`
          )
        )
      ),
      
      // Database selection when specific is selected
      databaseSelection === 'specific' && !loadingDatabases && React.createElement(
        Box,
        { flexDirection: 'column', marginTop: 1, marginLeft: 4 },
        // Show checkbox list if we have databases
        availableDatabases.length > 0 ? React.createElement(
          Box,
          { flexDirection: 'column', gap: 0 },
          React.createElement(
            Text,
            { color: colorPalettes.dust.tertiary, marginBottom: 0 },
            `Found ${availableDatabases.length} database${availableDatabases.length > 1 ? 's' : ''}. Select which to migrate:`
          ),
          ...availableDatabases.map((db, index) => {
            const isSelected = selectedDatabasesList.has(db);
            const isFocused = focusedField === `db-checkbox-${index}`;
            
            return React.createElement(
              Box,
              { key: db },
              React.createElement(
                Text,
                { 
                  color: isFocused ? 'cyan' : isSelected ? 'green' : 'white',
                  bold: isFocused
                },
                `  [${isSelected ? '✓' : ' '}] ${db}`
              )
            );
          })
        ) : React.createElement(
          Box,
          { flexDirection: 'column' },
          React.createElement(
            Text,
            { color: colorPalettes.dust.tertiary },
            'Could not fetch database list. Enter names manually:'
          ),
          editingField === 'db-input' ?
            React.createElement(TextInput, {
              defaultValue: selectedDatabases,
              placeholder: 'e.g., db1, db2, db3',
              onSubmit: (value) => {
                setSelectedDatabases(value);
                setEditingField(null);
                setError(null);
              }
            }) :
            React.createElement(
              Text,
              { 
                color: focusedField === 'db-input' ? 'cyan' : 'white',
                underline: focusedField === 'db-input'
              },
              `[${selectedDatabases || 'Enter database names...'}]`
            )
        )
      ),
      
      // Navigation hints
      !loadingDatabases && React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(
          Text,
          { color: colorPalettes.dust.tertiary },
          availableDatabases.length > 0 && databaseSelection === 'specific' ?
            '↑↓: navigate • Space: toggle • Enter: confirm • Esc: back' :
            '↑↓: select option • Enter: confirm • Esc: back to instances'
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
      !loadingDatabases && React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(
          Text,
          { color: 'green' },
          databaseSelection === 'all' ? 
            '✓ All databases will be migrated. Press Enter to continue.' :
            availableDatabases.length > 0 ?
              selectedDatabasesList.size > 0 ?
                `✓ Selected ${selectedDatabasesList.size} database${selectedDatabasesList.size > 1 ? 's' : ''}: ${Array.from(selectedDatabasesList).join(', ')}. Press Enter to continue.` :
                '⚠️ Please select at least one database' :
              selectedDatabases.trim() ? 
                `✓ Databases to migrate: ${selectedDatabases}. Press Enter to continue.` :
                '⚠️ Please specify database names or select "all databases"'
        )
      )
    );
  }

  // Render instance selection step
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