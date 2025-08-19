import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput, StatusMessage } from '@inkjs/ui';
import { colorPalettes } from '../theme/custom-theme.js';
import CloudSQLManager from '../../../infrastructure/cloud/gcp-cloudsql-manager.js';
import { ShimmerSpinner } from './CustomSpinner.js';
import SimpleSelect from './SimpleSelect.js';
import CustomMultiSelect from './CustomMultiSelect.js';
import projectHistory from '../../../infrastructure/config/project-history-manager.js';
import gcpProjectFetcher from '../../../infrastructure/cloud/gcp-project-fetcher.js';

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
  isSource = true
}) => {
  const [projectName, setProjectName] = useState('');
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState('loading'); // loading, input, scanning, selection
  const [scanCache, setScanCache] = useState({}); // Cache scan results
  const [suggestions, setSuggestions] = useState([]); // Autocomplete suggestions
  const [projectCount, setProjectCount] = useState(0); // Number of projects found
  const [loadingMessage, setLoadingMessage] = useState(
    'Loading available GCP projects...'
  ); // Dynamic loading message

  // Load autocomplete suggestions on component mount
  useEffect(() => {
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

  // Handle keyboard navigation
  useInput((input, key) => {
    if (key.escape) {
      if (currentStep !== 'input') {
        setCurrentStep('input');
        setError(null);
      } else {
        onCancel?.();
      }
    }

    // Add cache refresh functionality with F5 or Ctrl+R
    if ((key.function && key.name === 'f5') || (key.ctrl && input === 'r')) {
      if (currentStep === 'input') {
        refreshCache();
      }
    }
  });

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

  // Handle instance selection
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
              `💡 Start typing to see suggestions • Enter to accept • F5 to refresh cache`
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
