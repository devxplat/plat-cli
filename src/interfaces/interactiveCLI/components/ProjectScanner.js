import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput, StatusMessage } from '@inkjs/ui';
import { colorPalettes } from '../theme/custom-theme.js';
import CloudSQLManager from '../../../infrastructure/cloud/gcp-cloudsql-manager.js';
import { ShimmerSpinner } from './CustomSpinner.js';
import SimpleSelect from './SimpleSelect.js';
import CustomMultiSelect from './CustomMultiSelect.js';
import EnhancedInstanceSelector from './EnhancedInstanceSelector.js';
import projectHistory from '../../../infrastructure/config/project-history-manager.js';
import gcpProjectFetcher from '../../../infrastructure/cloud/gcp-project-fetcher.js';
import { PersistentCache } from '../../../infrastructure/cache/persistent-cache.js';

/**
 * ProjectScanner Component
 * Scans a GCP project for CloudSQL instances and allows multi-selection
 */
const ProjectScanner = ({
  label = 'Enter GCP Project',
  onComplete,
  onCancel,
  allowMultiple = true,
  filterByVersion = null,
  isSource = true,
  requireCredentials = false,
  initialData = null,
  navigationStack = null,
  parentComponent = null,
  parentStep = null
}) => {
  const [projectName, setProjectName] = useState(initialData?.project || '');
  const [instances, setInstances] = useState(initialData?.instances || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(initialData ? 'selection' : 'loading'); // loading, input, scanning, selection
  const [scanCache, setScanCache] = useState({}); // Cache scan results
  const [suggestions, setSuggestions] = useState([]); // Autocomplete suggestions
  const [projectCount, setProjectCount] = useState(0); // Number of projects found
  const [cache] = useState(() => new PersistentCache()); // Cache for credentials
  const [loadingMessage, setLoadingMessage] = useState(
    'Loading available GCP projects...'
  ); // Dynamic loading message
  const [hasNavigationStack] = useState(() => !!navigationStack); // Check if navigation stack is available
  const [isRestoringState, setIsRestoringState] = useState(false); // Flag to prevent re-pushing during restoration

  // Load autocomplete suggestions on component mount
  useEffect(() => {
    // Skip loading if we have initial data (we're returning from navigation)
    if (initialData && initialData.instances?.length > 0) {
      setIsRestoringState(true);
      setCurrentStep('selection');
      // If we have navigation stack, restore state
      if (hasNavigationStack && navigationStack) {
        const currentState = navigationStack.findComponentState('ProjectScanner');
        if (currentState && currentState.data) {
          setProjectName(currentState.data.projectName || initialData.project || '');
          setInstances(currentState.data.instances || initialData.instances || []);
          setCurrentStep(currentState.subStep || 'selection');
        }
      }
      setTimeout(() => setIsRestoringState(false), 100);
      return;
    }
    
    let mounted = true;

    const loadSuggestions = async (forceRefresh = false) => {
      try {
        // Ensure loading state is visible for minimum time (better UX)
        const startTime = Date.now();
        const minLoadingTime = 800; // 800ms minimum loading time

        // Set up progress callback for dynamic updates BEFORE any async operations
        gcpProjectFetcher.setProgressCallback((message) => {
          if (mounted) {
            setLoadingMessage(message || 'Loading available GCP projects...');
          }
        });

        // Start both operations in parallel
        const [recentProjects, gcpProjects] = await Promise.all([
          projectHistory.getRecentProjects(),
          gcpProjectFetcher.fetchProjects(forceRefresh)
        ]);

        // Combine and deduplicate suggestions
        const allSuggestions = [
          ...new Set([...recentProjects, ...gcpProjects])
        ];

        // Sort: recent projects first (maintain their order), then GCP projects alphabetically
        const sortedSuggestions = [
          ...recentProjects,
          ...gcpProjects.filter((p) => !recentProjects.includes(p)).sort()
        ];

        // Calculate remaining loading time to ensure minimum spinner visibility
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

        // Show final status message
        const cacheInfo = await gcpProjectFetcher.getCacheInfo();
        if (cacheInfo.hasCache && !forceRefresh) {
          const cacheAgeMinutes = Math.round(cacheInfo.cacheAge / 1000 / 60);
          setLoadingMessage(`Found ${sortedSuggestions.length} projects (cache: ${cacheAgeMinutes}m old)`);
        } else {
          setLoadingMessage(`Found ${sortedSuggestions.length} projects (fresh data)`);
        }

        // Wait for minimum loading time before transitioning
        if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }

        if (mounted) {
          setSuggestions(sortedSuggestions);
          setProjectCount(sortedSuggestions.length);
          // Transition to input state after ensuring minimum loading time
          setCurrentStep('input');
        }
      } catch (err) {
        // Silent fail - autocomplete is not critical
        if (mounted) {
          // Still transition to input even if loading fails
          setCurrentStep('input');
        }
      } finally {
        // Clear progress callback
        if (mounted) {
          gcpProjectFetcher.setProgressCallback(null);
        }
      }
    };

    loadSuggestions();

    return () => {
      mounted = false;
      gcpProjectFetcher.setProgressCallback(null);
    };
  }, []);

  // Update navigation stack when step changes
  useEffect(() => {
    if (hasNavigationStack && navigationStack && currentStep !== 'loading' && !isRestoringState) {
      // Check if we're already in the stack
      const currentState = navigationStack.peek();
      if (currentState?.component === 'ProjectScanner' && currentState?.subStep === currentStep) {
        // Already at this step, update data only
        navigationStack.replace({
          ...currentState,
          data: {
            projectName,
            instances,
            suggestions,
            error,
            isSource
          }
        });
      } else if (currentState?.component !== 'ProjectScanner' || currentState?.subStep !== currentStep) {
        // Only push if we're not the current component or if the substep changed
        // and we're not in the process of restoring state
        navigationStack.push({
          component: 'ProjectScanner',
          step: parentStep || 'projectScanner',
          subStep: currentStep,
          data: {
            projectName,
            instances,
            suggestions,
            error,
            isSource,
            formData: currentState?.data // Preserve parent form data
          },
          metadata: {
            label: `${label} - ${currentStep}`,
            parentComponent,
            stepIndex: currentState?.metadata?.stepIndex
          }
        });
      }
    }
  }, [currentStep, projectName, instances, error]);

  // Handle keyboard navigation
  useInput((input, key) => {
    // Only handle ESC if we're not in a child component
    const currentState = hasNavigationStack && navigationStack ? navigationStack.peek() : null;
    const isInChildComponent = currentState && currentState.component !== 'ProjectScanner' && currentState.component !== 'ConfigurationForm';
    
    if (key.escape && !isInChildComponent) {
      handleBack();
    }

    // Add cache refresh functionality with Ctrl+U or Ctrl+R
    if ((key.ctrl && input === 'u') || (key.ctrl && input === 'r')) {
      if (currentStep === 'input') {
        refreshCache();
      }
    }
  });

  // Handle back navigation
  const handleBack = () => {
    if (hasNavigationStack && navigationStack) {
      // Use navigation stack for back navigation
      const currentState = navigationStack.peek();
      
      if (currentState?.component === 'EnhancedInstanceSelector') {
        // Child component is active, let it handle its own navigation
        // Don't interfere with the navigation stack here
        return;
      }
      
      if (currentState?.component === 'ProjectScanner') {
        if (currentStep === 'selection') {
          // Pop the selection state and go back to input
          navigationStack.pop();
          setCurrentStep('input');
          setError(null);
        } else if (currentStep === 'input') {
          // Pop our state and go back to parent component
          navigationStack.pop();
          
          // Preserve current state if we have instances
          const preservedData = instances.length > 0 ? {
            project: projectName,
            instances,
            totalFound: instances.length,
            totalSelected: 0,
            isSource,
            currentStep
          } : null;
          onCancel?.(preservedData);
        }
      } else {
        // Not our state, just cancel
        onCancel?.();
      }
    } else {
      // Fallback to old behavior without navigation stack
      if (currentStep !== 'input') {
        // Preserve current state when going back
        const preservedData = {
          project: projectName,
          instances,
          totalFound: instances.length,
          totalSelected: 0,
          isSource,
          currentStep
        };
        
        if (currentStep === 'selection' && initialData) {
          // If we're in selection and have initial data, go back with preserved state
          onCancel?.(preservedData);
        } else {
          setCurrentStep('input');
          setError(null);
        }
      } else {
        // Preserve state when canceling from input if we have instances
        const preservedData = instances.length > 0 ? {
          project: projectName,
          instances,
          totalFound: instances.length,
          totalSelected: 0,
          isSource,
          currentStep: 'input'
        } : null;
        onCancel?.(preservedData);
      }
    }
  };

  // Function to refresh cache
  const refreshCache = async () => {
    setCurrentStep('loading');
    setLoadingMessage('Refreshing project cache...');
    
    try {
      const startTime = Date.now();
      const minLoadingTime = 1000; // 1 second minimum for refresh (user-initiated)

      // Set up progress callback for dynamic updates
      gcpProjectFetcher.setProgressCallback((message) => {
        setLoadingMessage(message || 'Refreshing project cache...');
      });

      // Force refresh of projects cache and get recent projects in parallel
      const [recentProjects, gcpProjects] = await Promise.all([
        projectHistory.getRecentProjects(),
        gcpProjectFetcher.fetchProjects(true)
      ]);

      // Combine and deduplicate suggestions
      const allSuggestions = [
        ...new Set([...recentProjects, ...gcpProjects])
      ];

      // Sort: recent projects first (maintain their order), then GCP projects alphabetically
      const sortedSuggestions = [
        ...recentProjects,
        ...gcpProjects.filter((p) => !recentProjects.includes(p)).sort()
      ];

      // Show completion message
      setLoadingMessage(`Found ${sortedSuggestions.length} projects (refreshed)`);

      // Ensure minimum loading time for user feedback
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      setSuggestions(sortedSuggestions);
      setProjectCount(sortedSuggestions.length);
      setCurrentStep('input');
    } catch (err) {
      setError('Failed to refresh cache. Using existing data.');
      setCurrentStep('input');
    } finally {
      gcpProjectFetcher.setProgressCallback(null);
    }
  };

  // Scan CloudSQL instances in the project
  const scanProject = async (project) => {
    // Check cache first (5 minute TTL)
    const cacheKey = project;
    const cached = scanCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.data;
    }

    setLoading(true);
    setError(null);

    try {
      // Create silent logger to prevent console output pollution
      const silentLogger = {
        info: () => {},
        debug: () => {},
        warn: () => {},
        error: () => {},
        log: () => {}
      };

      // Initialize CloudSQL Manager with silent logger
      const manager = new CloudSQLManager(silentLogger, project);
      await manager.init();

      // List all instances
      const instanceList = await manager.listAllInstances();

      // Get detailed information for each instance
      const detailedInstances = await Promise.all(
        instanceList.map(async (inst) => {
          try {
            const details = await manager.getInstanceDetails(inst.name);
            // Fetch databases for this instance
            let databases = [];
            try {
              databases = await manager.getInstanceDatabases(inst.name);
            } catch (dbErr) {
              // If database fetch fails, continue with empty array
              databases = [];
            }

            return {
              project,
              instance: inst.name,
              version: details.parsedVersion || inst.databaseVersion,
              databaseVersion: inst.databaseVersion,
              state: inst.state,
              region: inst.region,
              publicIp: details.publicIp || 'None',
              tier: details.settings?.tier || 'Unknown',
              diskSize: details.settings?.dataDiskSizeGb || 0,
              databases: databases,
              databaseCount: databases.length,
              connectionName: details.connectionName,
              label: `${inst.name} (PG ${details.parsedVersion || 'Unknown'}, ${inst.region}, ${databases.length} DBs)`
            };
          } catch (err) {
            // Return basic info if details fail
            return {
              project,
              instance: inst.name,
              version: 'Unknown',
              databaseVersion: inst.databaseVersion,
              state: inst.state,
              region: inst.region,
              databases: [],
              databaseCount: 0,
              label: `${inst.name} (${inst.databaseVersion}, ${inst.region}, 0 DBs)`
            };
          }
        })
      );

      // Filter by version if specified
      let filteredInstances = detailedInstances.filter(
        (inst) => inst.state === 'RUNNABLE'
      );

      if (filterByVersion) {
        filteredInstances = filteredInstances.filter(
          (inst) => inst.version === filterByVersion
        );
      }

      // Cache the results
      setScanCache({
        ...scanCache,
        [cacheKey]: {
          timestamp: Date.now(),
          data: filteredInstances
        }
      });

      return filteredInstances;
    } catch (err) {
      // Provide more specific error messages based on error type
      const errorMessage = err.message.toLowerCase();

      if (errorMessage.includes('permission') || errorMessage.includes('403')) {
        throw new Error(
          `Permission denied: Ensure you have CloudSQL Admin role for project "${project}"`
        );
      } else if (
        errorMessage.includes('not found') ||
        errorMessage.includes('404')
      ) {
        throw new Error(
          `Project "${project}" not found or you don't have access to it`
        );
      } else if (
        errorMessage.includes('api') &&
        errorMessage.includes('not enabled')
      ) {
        throw new Error(
          `CloudSQL API is not enabled for project "${project}". Enable it in the GCP Console`
        );
      } else if (
        errorMessage.includes('invalid') ||
        errorMessage.includes('format')
      ) {
        throw new Error(
          `Invalid project ID format: "${project}". Project IDs must be 6-30 lowercase letters, digits, or hyphens`
        );
      } else if (errorMessage.includes('credentials')) {
        throw new Error(
          `Authentication failed. Please run: gcloud auth application-default login`
        );
      }

      // Default error message with more context
      throw new Error(`Failed to scan project "${project}": ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle project submission
  const handleProjectSubmit = async (value) => {
    if (!value || !value.trim()) {
      setError('Please enter a valid project ID');
      return;
    }

    // Basic validation for GCP project ID format
    const projectId = value.trim();
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
      if (projectId.length < 6) {
        setError('Project ID must be at least 6 characters long');
      } else if (projectId.length > 30) {
        setError('Project ID must be 30 characters or less');
      } else if (/[A-Z]/.test(projectId)) {
        setError('Project ID must use lowercase letters only');
      } else if (/[^a-z0-9-]/.test(projectId)) {
        setError(
          'Project ID can only contain lowercase letters, numbers, and hyphens'
        );
      } else {
        setError('Invalid project ID format');
      }
      return;
    }

    // Update project name with the full autocompleted value
    setProjectName(projectId);
    setCurrentStep('scanning');

    try {
      const scannedInstances = await scanProject(projectId);

      if (scannedInstances.length === 0) {
        setError('No CloudSQL instances found in this project');
        setCurrentStep('input');
        return;
      }

      setInstances(scannedInstances);
      setCurrentStep('selection');

      // Add successful project to history for future autocomplete (now async)
      await projectHistory.addProject(projectId);
    } catch (err) {
      setError(err.message);
      setCurrentStep('input');
    }
  };

  // Handle instance selection (legacy for non-credential mode)
  const handleInstanceSelection = (selectedValues) => {
    const selected = selectedValues.map((v) => instances[parseInt(v)]);

    onComplete({
      project: projectName,
      instances: selected,
      totalFound: instances.length,
      totalSelected: selected.length,
      isSource
    });
  };

  // Handle enhanced selection with credentials
  const handleEnhancedSelection = (result) => {
    onComplete(result);
  };

  // Render based on current step
  const renderContent = () => {
    switch (currentStep) {
      case 'loading':
        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1 },
          React.createElement(ShimmerSpinner, {
            label: loadingMessage,
            isVisible: true,
            status: 'running'
          })
        );

      case 'input':
        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1 },
          React.createElement(
            Text,
            { color: colorPalettes.dust.primary },
            `🔍 ${label}:`
          ),
          React.createElement(TextInput, {
            placeholder:
              projectCount > 0
                ? `Enter GCP project ID (${projectCount} available)...`
                : 'Enter GCP project ID...',
            defaultValue: projectName,
            suggestions: suggestions,
            onChange: setProjectName,
            onSubmit: handleProjectSubmit
          }),
          error &&
            React.createElement(StatusMessage, { variant: 'error' }, error),
          !error &&
            projectCount > 0 &&
            React.createElement(
              Text,
              { color: colorPalettes.dust.tertiary, dimColor: true },
              `💡 Start typing to see suggestions • Enter to accept • Ctrl+U to refresh cache`
            )
        );

      case 'scanning':
        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1 },
          React.createElement(ShimmerSpinner, {
            label: `Scanning project ${projectName} for CloudSQL instances...`,
            isVisible: true,
            status: 'running'
          })
        );

      case 'selection':
        // Use enhanced selector if credentials are required
        if (requireCredentials) {
          return React.createElement(EnhancedInstanceSelector, {
            instances,
            navigationStack, // Pass navigation stack to child
            parentComponent: 'ProjectScanner',
            parentStep: parentStep, // Pass through the parent step from ConfigurationForm
            onSubmit: handleEnhancedSelection,
            onCancel: (cancelInfo) => {
              // When EnhancedInstanceSelector cancels back to us
              // Clean up its states from the navigation stack
              if (hasNavigationStack && navigationStack) {
                while (navigationStack.peek()?.component === 'EnhancedInstanceSelector') {
                  navigationStack.pop();
                }
              }
              
              // Check if this is a full cancel from instances step
              // If it has fromStep, it means user pressed ESC on instances (not databases)
              if (cancelInfo && cancelInfo.fromStep === 'instances') {
                // Go back to input step
                setCurrentStep('input');
                setError(null);
              } else {
                // This shouldn't happen with current flow, but handle gracefully
                setCurrentStep('input');
                setError(null);
              }
            },
            allowMultiple,
            label: `Select CloudSQL Instances`,
            isSource,
            // Pass initial state if we have it
            initialSelections: initialData?.initialSelections || [],
            initialCredentials: initialData?.initialCredentials || {},
            initialCredentialsMode: initialData?.initialCredentialsMode || 'individual',
            cache // Pass the cache instance for credential management
          });
        }

        // Legacy selection mode without credentials
        const options = instances.map((inst, index) => ({
          label: inst.label,
          value: index.toString()
        }));

        // Group instances by version for better organization
        const versionGroups = {};
        instances.forEach((inst, index) => {
          const version = inst.version || 'Unknown';
          if (!versionGroups[version]) {
            versionGroups[version] = [];
          }
          versionGroups[version].push({ ...inst, index });
        });

        return React.createElement(
          Box,
          { flexDirection: 'column', gap: 1 },
          React.createElement(
            Text,
            { color: colorPalettes.dust.primary },
            `🔧 Select CloudSQL Instances (${instances.length} found):`
          ),

          // Show version distribution
          Object.keys(versionGroups).length > 1 &&
            React.createElement(
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

          // Selection instruction hint - similar to autocomplete hint on previous page
          React.createElement(
            Text,
            { color: colorPalettes.dust.tertiary, dimColor: false },
            allowMultiple
              ? '💡 Use Space to select/deselect instances • ↑↓ to navigate'
              : '💡 Use ↑↓ to navigate • Enter to select'
          ),

          allowMultiple
            ? React.createElement(CustomMultiSelect, {
                options,
                defaultValue: [], // Start with nothing selected
                onSubmit: handleInstanceSelection,
                showNavigationHints: false // ProjectScanner shows its own navigation hints
              })
            : React.createElement(SimpleSelect, {
                options,
                onSubmit: (value) => handleInstanceSelection([value]),
                defaultValue: options[0]?.value,
                showNavigationHints: false // ProjectScanner shows its own navigation hints
              }),

          error &&
            React.createElement(StatusMessage, { variant: 'error' }, error)
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

export default ProjectScanner;
