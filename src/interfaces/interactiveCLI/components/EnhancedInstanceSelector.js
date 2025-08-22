import React, { useState, useEffect, useCallback } from 'react';
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
  cache = null, // Pass PersistentCache instance for saving/loading credentials
  navigationStack = null,
  parentComponent = null,
  parentStep = null
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
  const [selectedDatabases, setSelectedDatabases] = useState(''); // For manual input fallback
  const [availableDatabases, setAvailableDatabases] = useState({}); // Map of instanceKey -> database list
  const [selectedDatabasesList, setSelectedDatabasesList] = useState({}); // Map of instanceKey -> Set of selected databases
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
  const [hasNavigationStack] = useState(() => !!navigationStack); // Check if navigation stack is available
  const [isRestoring, setIsRestoring] = useState(false); // Flag to prevent re-pushing during restoration
  
  const { enableFocus, disableFocus, focusNext, focusPrevious } = useFocusManager();

  // Update navigation stack when step changes
  useEffect(() => {
    if (hasNavigationStack && navigationStack && !isRestoring) {
      const currentState = navigationStack.peek();
      
      // Don't push if we're already at this exact state
      if (currentState?.component === 'EnhancedInstanceSelector' && currentState?.subStep === currentStep) {
        return;
      }
      
      // Push database step to stack when transitioning to it from instances
      if (currentStep === 'databases') {
        // Only push if we're transitioning from instances to databases
        // This ensures we have a state to pop when going back
        if (!currentState || currentState.component !== 'EnhancedInstanceSelector' || currentState.subStep !== 'databases') {
          navigationStack.push({
            component: 'EnhancedInstanceSelector',
            step: parentStep || 'instanceSelector',
            subStep: currentStep,
            data: {
              selectedInstances: Array.from(selectedInstances),
              credentials,
              credentialsMode,
              sameCredentials,
              databaseSelection,
              selectedDatabases,
              selectedDatabasesList: Object.keys(selectedDatabasesList).reduce((acc, key) => {
                acc[key] = Array.from(selectedDatabasesList[key] || new Set());
                return acc;
              }, {}),
              availableDatabases,
              saveCredentialsState,
              showCredentials,
              focusedIndex,
              focusedField,
              isSource,
              currentStep,
              formData: currentState?.data?.formData // Preserve parent form data
            },
            metadata: {
              label: `${label} - ${currentStep}`,
              parentComponent,
              stepIndex: currentState?.metadata?.stepIndex
            }
          });
        }
      }
    }
  }, [currentStep]); // Only track currentStep changes

  // Restore state from navigation stack if available
  useEffect(() => {
    if (hasNavigationStack && navigationStack) {
      const savedState = navigationStack.findComponentState('EnhancedInstanceSelector');
      if (savedState && savedState.data && !isRestoring) {
        setIsRestoring(true);
        
        // Restore all state
        const data = savedState.data;
        if (data.selectedInstances) {
          setSelectedInstances(new Set(data.selectedInstances));
        }
        if (data.credentials) {
          setCredentials(data.credentials);
        }
        if (data.credentialsMode) {
          setCredentialsMode(data.credentialsMode);
        }
        if (data.sameCredentials) {
          setSameCredentials(data.sameCredentials);
        }
        if (data.currentStep) {
          setCurrentStep(data.currentStep);
        }
        if (data.databaseSelection) {
          setDatabaseSelection(data.databaseSelection);
        }
        if (data.selectedDatabases !== undefined) {
          setSelectedDatabases(data.selectedDatabases);
        }
        if (data.selectedDatabasesList) {
          // Convert back to Sets
          const restoredList = {};
          Object.keys(data.selectedDatabasesList).forEach(key => {
            restoredList[key] = new Set(data.selectedDatabasesList[key]);
          });
          setSelectedDatabasesList(restoredList);
        }
        if (data.availableDatabases) {
          setAvailableDatabases(data.availableDatabases);
        }
        if (data.saveCredentialsState) {
          setSaveCredentialsState(data.saveCredentialsState);
        }
        if (data.showCredentials) {
          setShowCredentials(data.showCredentials);
        }
        if (data.focusedIndex !== undefined) {
          setFocusedIndex(data.focusedIndex);
        }
        if (data.focusedField) {
          setFocusedField(data.focusedField);
        }
        
        setTimeout(() => setIsRestoring(false), 100);
      }
    }
  }, []);

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

  // Handle submission - defined before handleInput to avoid initialization errors
  const handleSubmit = useCallback(async () => {
    // Database validation when on database step (only for source instances)
    if (isSource && currentStep === 'databases' && databaseSelection === 'specific') {
      const instanceKeys = Array.from(selectedInstances);
      const hasAnyDatabases = instanceKeys.some(key => (availableDatabases[key] || []).length > 0);
      
      if (hasAnyDatabases) {
        // Check if at least one database is selected across all instances
        let totalSelected = 0;
        for (const instanceKey of instanceKeys) {
          const selected = selectedDatabasesList[instanceKey];
          if (selected && selected.size > 0) {
            totalSelected += selected.size;
          }
        }
        if (totalSelected === 0) {
          setError('Please select at least one database');
          return;
        }
      } else if (!selectedDatabases.trim()) {
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
            // Check if we have fetched databases for this instance
            const instanceDatabases = availableDatabases[key];
            
            if (instanceDatabases && instanceDatabases.length > 0) {
              // Use the selected databases for this specific instance
              const selectedForInstance = selectedDatabasesList[key];
              if (selectedForInstance && selectedForInstance.size > 0) {
                instResult.databases = Array.from(selectedForInstance);
              } else {
                // If no databases selected for this instance, skip it or use all
                instResult.databases = [];
              }
            } else if (selectedDatabases.trim()) {
              // Manual input fallback - apply to all instances
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
      databaseSelection: isSource ? databaseSelection : undefined
      // Note: databases are now included per-instance in the instances array
    });
  }, [
    currentStep, databaseSelection, selectedDatabasesList, availableDatabases,
    selectedDatabases, credentialsMode, sameCredentials, credentials,
    selectedInstances, instances, isSource, onSubmit, cache, saveCredentialsState
  ]);

  // Handle moving to database selection step - defined before handleInput
  const handleMoveToDatabase = useCallback(async () => {
    
    // Validate selection
    if (selectedInstances.size === 0) {
      setError('Please select at least one instance');
      return;
    }

    // Validate credentials based on mode
    if (credentialsMode === 'same') {
      if (!sameCredentials.user || !sameCredentials.password) {
        setError('Please provide username and password for all instances');
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

    // Fetch databases from ALL selected instances
    setLoadingDatabases(true);
    setCurrentStep('databases');
    setFocusedField('db-radio-all'); // Set initial focus for database step
    setError(null);

    try {
      // Import ConnectionManager to fetch databases
      const ConnectionManager = (await import('../../../infrastructure/cloud/gcp-connection-manager.js')).default;
      
      // Create a proper logger with all required methods
      const logger = {
        debug: (msg, data) => {}, // Silent in production
        info: (msg) => {}, // Silent in production
        warn: (msg) => console.warn('WARN:', msg),
        error: (msg, error) => console.error('ERROR:', msg, error),
        logConnectionError: (key, error, attempt, maxAttempts) => {
          // Only log if it's the last attempt
          if (attempt === maxAttempts) {
            console.error(`Connection failed for ${key}:`, error.message);
          }
        },
        logConnectionAttempt: () => {}, // Silent
        logConnectionSuccess: () => {}, // Silent
        logRetry: () => {} // Silent
      };
      
      const connectionManager = new ConnectionManager(logger);
      const allDatabases = {};
      const allSelectedDatabases = {};
      let hasAnyDatabases = false;
      
      // Fetch databases for ALL selected instances
      for (const instanceKey of selectedInstances) {
        const [project, instanceName] = instanceKey.split(':');
        const instance = instances.find(inst => 
          `${inst.project}:${inst.instance}` === instanceKey
        );
        
        if (instance) {
          // Get credentials for this instance
          let creds;
          if (credentialsMode === 'same') {
            creds = sameCredentials;
          } else if (credentialsMode === 'individual') {
            creds = credentials[instanceKey];
          } else {
            creds = {
              user: process.env[`PGUSER_${instance.instance.toUpperCase().replace(/-/g, '_')}`] || 'postgres',
              password: process.env[`PGPASSWORD_${instance.instance.toUpperCase().replace(/-/g, '_')}`] || ''
            };
          }
          
          try {
            // Create connection info for the database query
            const connectionInfo = {
              ip: instance.publicIp || instance.ip,
              user: creds.user,
              password: creds.password,
              useProxy: false
            };
            
            // Fetch databases using ConnectionManager
            const databaseList = await connectionManager.listDatabases(
              instance.project,
              instance.instance,
              isSource,
              connectionInfo
            );
            
            // Extract database names from the result
            const databases = databaseList.map(db => db.name);
            
            allDatabases[instanceKey] = databases;
            allSelectedDatabases[instanceKey] = new Set();
            
            if (databases.length > 0) {
              hasAnyDatabases = true;
            }
          } catch (error) {
            // If we can't fetch databases for this instance, mark it as failed
            console.error(`Failed to fetch databases for ${instanceKey}:`, error.message);
            allDatabases[instanceKey] = [];
            allSelectedDatabases[instanceKey] = new Set();
          } finally {
            // Clean up connection if needed
            try {
              await connectionManager.closeConnection(instance.project, instance.instance, 'postgres');
            } catch (err) {
              // Ignore cleanup errors
            }
          }
        }
      }
      
      setAvailableDatabases(allDatabases);
      setSelectedDatabasesList(allSelectedDatabases);
      
      // If we have databases, default to specific selection
      if (hasAnyDatabases) {
        setDatabaseSelection('specific');
        setFocusedField('db-inst-0-db-0'); // Updated focus field format
      } else {
        // If no databases could be fetched, show manual input option
        setError('Could not fetch database lists. You can still select "all databases" or enter names manually.');
      }
    } catch (error) {
      setError('Failed to fetch databases: ' + error.message);
    } finally {
      setLoadingDatabases(false);
    }
  }, [
    selectedInstances, credentialsMode, sameCredentials, credentials,
    instances, isSource, cache
  ]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (editingField) {
      // Just exit editing mode, stay on the same screen
      setEditingField(null);
      return;
    }
    
    if (hasNavigationStack && navigationStack) {
      // Check if we're navigating within the component
      if (currentStep === 'databases') {
        // We're in databases step, need to go back to instances
        const currentState = navigationStack.peek();
        
        // Check if the current state is our databases step
        if (currentState?.component === 'EnhancedInstanceSelector' && currentState?.subStep === 'databases') {
          // Pop the database step from stack
          navigationStack.pop();
        }
        
        // Go back to instance selection - stay within the component
        setCurrentStep('instances');
        setFocusedField('mode');
        // Important: return here to prevent calling onCancel
        // We're just moving between steps within the same component
        return;
      }
      
      // Now handle going back from instances to parent
      const currentState = navigationStack.peek();
      
      if (currentStep === 'instances') {
        // We're in the instances step and want to go back to parent
        // Pop our state from stack if it exists
        if (currentState?.component === 'EnhancedInstanceSelector') {
          navigationStack.pop();
        }
        
        // Signal to parent that we're canceling from instances step
        // Pass a flag to indicate this is a full cancel, not internal navigation
        onCancel?.({ fromStep: 'instances' });
      } else {
        // Shouldn't reach here, but just in case
        onCancel?.();
      }
    } else {
      // Fallback to old behavior without navigation stack
      if (currentStep === 'databases') {
        // Go back to instance selection
        setCurrentStep('instances');
        setFocusedField('mode');
        // Don't call onCancel - we're just navigating internally
        return;
      } else {
        // We're at instances step, cancel back to parent
        onCancel?.({ fromStep: 'instances' });
      }
    }
  }, [editingField, currentStep, hasNavigationStack, navigationStack, instances, selectedInstances, 
      credentialsMode, sameCredentials, credentials, databaseSelection, selectedDatabases, 
      isSource, onCancel]);

  // Create input handler with dependencies
  const handleInput = useCallback((input, key) => {
    // Handle escape - but only if we're the active component
    if (key.escape) {
      // Check if we're the current component on the navigation stack
      const currentState = hasNavigationStack && navigationStack ? navigationStack.peek() : null;
      const isActive = !currentState || currentState.component === 'EnhancedInstanceSelector' || 
                      (currentState.component === 'ProjectScanner' && currentStep === 'instances');
      
      if (isActive) {
        handleBack();
      }
      return;
    }

    // Don't process navigation keys when editing
    if (editingField) {
      return;
    }

    // Enter to edit field or submit - MOVED HERE to process before navigation blocks
    if (key.return) {
      if (currentStep === 'instances') {
        if (focusedField === 'user' || focusedField === 'password' || 
            focusedField === 'same-user' || focusedField === 'same-password') {
          setEditingField(focusedField);
        } else if (focusedField === 'checkbox' || focusedField === 'mode') {
          // For source instances, move to database selection
          // For target instances, submit directly
          if (isSource) {
            handleMoveToDatabase();
          } else {
            handleSubmit();
          }
        }
      } else if (currentStep === 'databases') {
        // On database step, handle database selection inputs
        if (focusedField === 'db-radio-all') {
          // Select "all databases" and submit
          setDatabaseSelection('all');
          setSelectedDatabasesList({});
          handleSubmit();
        } else if (focusedField === 'db-radio-specific') {
          // Select "specific databases" and move focus to database list or input
          setDatabaseSelection('specific');
          const instanceKeys = Array.from(selectedInstances);
          const hasAnyDatabases = instanceKeys.some(key => (availableDatabases[key] || []).length > 0);
          
          if (hasAnyDatabases) {
            // Find first instance with databases
            for (let i = 0; i < instanceKeys.length; i++) {
              const databases = availableDatabases[instanceKeys[i]] || [];
              if (databases.length > 0) {
                setFocusedField(`db-inst-${i}-db-0`);
                break;
              }
            }
          } else {
            setFocusedField('db-input');
          }
        } else if (focusedField === 'db-input') {
          setEditingField('db-input');
        } else {
          // For checkboxes or other fields, submit
          handleSubmit();
        }
      }
    }

    // Database step navigation
    if (currentStep === 'databases') {
      if (key.upArrow) {
        if (focusedField === 'db-radio-specific') {
          setFocusedField('db-radio-all');
        } else if (focusedField === 'db-radio-all') {
          // Stay at top
        } else if (focusedField.startsWith('db-inst-')) {
          // Navigation for per-instance database checkboxes
          const parts = focusedField.split('-');
          const instIndex = parseInt(parts[2]);
          const dbIndex = parseInt(parts[4]);
          
          if (dbIndex > 0) {
            // Move to previous database in same instance
            setFocusedField(`db-inst-${instIndex}-db-${dbIndex - 1}`);
          } else if (instIndex > 0) {
            // Move to last database of previous instance
            const instanceKeys = Array.from(selectedInstances);
            const prevInstanceKey = instanceKeys[instIndex - 1];
            const prevDatabases = availableDatabases[prevInstanceKey] || [];
            if (prevDatabases.length > 0) {
              setFocusedField(`db-inst-${instIndex - 1}-db-${prevDatabases.length - 1}`);
            } else {
              setFocusedField('db-radio-specific');
            }
          } else {
            setFocusedField('db-radio-specific');
          }
        }
      }
      
      if (key.downArrow) {
        if (focusedField === 'db-radio-all') {
          setFocusedField('db-radio-specific');
        } else if (focusedField === 'db-radio-specific') {
          if (databaseSelection === 'specific') {
            // Move to first database of first instance with databases
            const instanceKeys = Array.from(selectedInstances);
            for (let i = 0; i < instanceKeys.length; i++) {
              const databases = availableDatabases[instanceKeys[i]] || [];
              if (databases.length > 0) {
                setFocusedField(`db-inst-${i}-db-0`);
                break;
              }
            }
          }
        } else if (focusedField.startsWith('db-inst-')) {
          // Navigation for per-instance database checkboxes
          const parts = focusedField.split('-');
          const instIndex = parseInt(parts[2]);
          const dbIndex = parseInt(parts[4]);
          const instanceKeys = Array.from(selectedInstances);
          const currentInstanceKey = instanceKeys[instIndex];
          const currentDatabases = availableDatabases[currentInstanceKey] || [];
          
          if (dbIndex < currentDatabases.length - 1) {
            // Move to next database in same instance
            setFocusedField(`db-inst-${instIndex}-db-${dbIndex + 1}`);
          } else if (instIndex < instanceKeys.length - 1) {
            // Move to first database of next instance
            const nextInstanceKey = instanceKeys[instIndex + 1];
            const nextDatabases = availableDatabases[nextInstanceKey] || [];
            if (nextDatabases.length > 0) {
              setFocusedField(`db-inst-${instIndex + 1}-db-0`);
            }
          }
        }
      }
      
      // Space to select radio option or toggle checkbox
      if (input === ' ') {
        if (focusedField === 'db-radio-all') {
          setDatabaseSelection('all');
          setSelectedDatabasesList({}); // Clear all selections
        } else if (focusedField === 'db-radio-specific') {
          setDatabaseSelection('specific');
          // Move to first database if available
          const instanceKeys = Array.from(selectedInstances);
          for (let i = 0; i < instanceKeys.length; i++) {
            const databases = availableDatabases[instanceKeys[i]] || [];
            if (databases.length > 0) {
              setFocusedField(`db-inst-${i}-db-0`);
              break;
            }
          }
        } else if (focusedField.startsWith('db-inst-')) {
          // Toggle database selection for specific instance
          const parts = focusedField.split('-');
          const instIndex = parseInt(parts[2]);
          const dbIndex = parseInt(parts[4]);
          const instanceKeys = Array.from(selectedInstances);
          const instanceKey = instanceKeys[instIndex];
          const databases = availableDatabases[instanceKey] || [];
          const dbName = databases[dbIndex];
          
          const newSelected = { ...selectedDatabasesList };
          if (!newSelected[instanceKey]) {
            newSelected[instanceKey] = new Set();
          }
          
          if (newSelected[instanceKey].has(dbName)) {
            newSelected[instanceKey].delete(dbName);
          } else {
            newSelected[instanceKey].add(dbName);
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

    // Ctrl+A to toggle credentials mode
    if (key.ctrl && input === 'a') {
      const modes = ['individual', 'same', 'env'];
      const currentIdx = modes.indexOf(credentialsMode);
      const nextIdx = (currentIdx + 1) % modes.length;
      setCredentialsMode(modes[nextIdx]);
    }
  }, [
    currentStep, focusedField, editingField, databaseSelection,
    selectedInstances, selectedDatabasesList, availableDatabases,
    credentials, credentialsMode, sameCredentials, instances,
    selectedDatabases, isSource, onCancel, handleSubmit, handleMoveToDatabase,
    focusedIndex
  ]);

  // Use the input handler
  useInput(handleInput);

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
        // Show databases grouped by instance
        (() => {
          const instanceKeys = Array.from(selectedInstances);
          const hasAnyDatabases = instanceKeys.some(key => (availableDatabases[key] || []).length > 0);
          
          if (hasAnyDatabases) {
            // Render databases grouped by instance
            return React.createElement(
              Box,
              { flexDirection: 'column', gap: 1 },
              ...instanceKeys.map((instanceKey, instIndex) => {
                const databases = availableDatabases[instanceKey] || [];
                const instance = instances.find(inst => 
                  `${inst.project}:${inst.instance}` === instanceKey
                );
                
                if (databases.length === 0) {
                  return React.createElement(
                    Box,
                    { key: instanceKey, flexDirection: 'column', marginBottom: 1 },
                    React.createElement(
                      Text,
                      { color: colorPalettes.dust.tertiary },
                      `📦 ${instance?.label || instanceKey}: No databases found`
                    )
                  );
                }
                
                return React.createElement(
                  Box,
                  { key: instanceKey, flexDirection: 'column', marginBottom: 1 },
                  React.createElement(
                    Text,
                    { color: colorPalettes.dust.secondary, bold: true },
                    `📦 ${instance?.label || instanceKey}:`
                  ),
                  ...databases.map((db, dbIndex) => {
                    const isSelected = selectedDatabasesList[instanceKey]?.has(db) || false;
                    const isFocused = focusedField === `db-inst-${instIndex}-db-${dbIndex}`;
                    
                    return React.createElement(
                      Box,
                      { key: `${instanceKey}-${db}`, marginLeft: 2 },
                      React.createElement(
                        Text,
                        { 
                          color: isFocused ? 'cyan' : isSelected ? 'green' : 'white',
                          bold: isFocused
                        },
                        `[${isSelected ? '✓' : ' '}] ${db}`
                      )
                    );
                  })
                );
              })
            );
          } else {
            // No databases found for any instance - show manual input
            return React.createElement(
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
            );
          }
        })()
      ),
      
      // Navigation hints
      !loadingDatabases && React.createElement(
        Box,
        { marginTop: 1 },
        React.createElement(
          Text,
          { color: colorPalettes.dust.tertiary },
          (() => {
            const instanceKeys = Array.from(selectedInstances);
            const hasAnyDatabases = instanceKeys.some(key => (availableDatabases[key] || []).length > 0);
            return hasAnyDatabases && databaseSelection === 'specific' ?
              '↑↓: navigate • Space: toggle • Enter: confirm • Esc: back' :
              '↑↓: select option • Enter: confirm • Esc: back to instances';
          })()
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
          (() => {
            if (databaseSelection === 'all') {
              return '✓ All databases will be migrated. Press Enter to continue.';
            }
            
            const instanceKeys = Array.from(selectedInstances);
            const hasAnyDatabases = instanceKeys.some(key => (availableDatabases[key] || []).length > 0);
            
            if (hasAnyDatabases) {
              // Count total selected databases across all instances
              let totalSelected = 0;
              let summary = [];
              
              for (const instanceKey of instanceKeys) {
                const selected = selectedDatabasesList[instanceKey];
                if (selected && selected.size > 0) {
                  totalSelected += selected.size;
                  const instance = instances.find(inst => 
                    `${inst.project}:${inst.instance}` === instanceKey
                  );
                  summary.push(`${instance?.label || instanceKey}: ${selected.size}`);
                }
              }
              
              if (totalSelected > 0) {
                return `✓ Selected ${totalSelected} database${totalSelected > 1 ? 's' : ''} (${summary.join(', ')}). Press Enter to continue.`;
              } else {
                return '⚠️ Please select at least one database';
              }
            } else if (selectedDatabases.trim()) {
              return `✓ Databases to migrate: ${selectedDatabases}. Press Enter to continue.`;
            } else {
              return '⚠️ Please specify database names or select "all databases"';
            }
          })()
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