import React, { useState } from 'react';
import { render, Box, Text, Static, useInput } from 'ink';
import { StatusMessage, ProgressBar, ThemeProvider, Select } from '@inkjs/ui';
import customTheme from '../interfaces/interactiveCLI/theme/custom-theme.js';
import { ShimmerSpinner } from '../interfaces/interactiveCLI/components/CustomSpinner.js';
import CustomProgressBar from '../interfaces/interactiveCLI/components/CustomProgressBar.js';
import TodoList from '../interfaces/interactiveCLI/components/TodoList.js';

/**
 * Component for selecting next actions after migration completes
 */
const NextActionsSelector = ({ onAction }) => {
  const options = [
    { label: '↩️  Return to Main Menu', value: 'menu' },
    { label: '🔄 Run Another Migration', value: 'retry' },
    { label: '📋 View Detailed Logs', value: 'logs' },
    { label: '🚪 Exit CLI', value: 'exit' }
  ];

  return React.createElement(
    Box,
    { flexDirection: 'column', marginTop: 2 },
    React.createElement(
      Text,
      { color: 'cyan' },
      'What would you like to do next?'
    ),
    React.createElement(
      Box,
      { marginTop: 1 },
      React.createElement(Select, {
        options,
        onChange: (value) => onAction(value)
      })
    )
  );
};

/**
 * Modern Progress Tracker using Ink UI components
 * Provides spinner-based progress indication with detailed progress bars for complex phases
 */
class ModernProgressTracker {
  constructor(logger = null) {
    this.logger = logger || console;

    // State management
    this.phases = [];
    this.currentPhase = null;
    this.currentPhaseIndex = 0;
    this.isActive = false;
    this.startTime = null;
    this.inkInstance = null;
    this.statusMessages = [];
    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this._lastUpdateTime = null;
    
    // TODO list tracking
    this.todoTasks = [];
    this.completedTasks = [];

    // Detailed phase tracking
    this.detailedPhases = ['Export', 'Import'];
    this.phaseDetails = {
      currentItem: null,
      currentItemIndex: 0,
      totalItems: 0,
      currentItemSize: 0,
      bytesProcessed: 0,
      phaseStartTime: null,
      lastUpdateTime: null
    };

    // Statistics
    this.stats = {
      totalItems: 0,
      processedItems: 0,
      totalSizeBytes: 0,
      processedSizeBytes: 0,
      phases: {}
    };

    // Performance metrics based on real-world data
    // 35MB in 60s = ~600KB/s throughput
    this.performanceMetrics = {
      exportThroughput: 600 * 1024, // 600 KB/s in bytes
      importThroughput: 600 * 1024, // 600 KB/s in bytes
      // Add overhead for connection setup, validation, etc.
      connectionOverhead: 2000, // 2 seconds
      // Variation factor for realistic speed fluctuations
      speedVariation: 0.1 // ±10% variation
    };

    // Predictive progress tracking
    this.predictiveProgress = {
      isActive: false,
      interval: null,
      startTime: null,
      estimatedDuration: 0,
      currentProgress: 0,
      targetProgress: 100,
      itemStartTime: null,
      itemSize: 0,
      speedHistory: [], // Track last 5 speed measurements
      lastSpeedUpdate: null,
      displayedSpeed: null, // Cached speed for display
      lastSpeedDisplayUpdate: null, // Last time we updated displayed speed
      displayedETA: null, // Cached ETA for display
      lastETADisplayUpdate: null // Last time we updated displayed ETA
    };
  }

  /**
   * Initialize the tracker with phases and overall progress
   */
  init(phases) {
    this.phases = phases;
    this.startTime = Date.now();
    this.isActive = true;
    this.statusMessages = [];
    this.elapsedSeconds = 0;
    
    // Initialize TODO tasks based on phases
    this.todoTasks = phases.map((phase, index) => ({
      id: `phase-${index}`,
      name: phase,
      label: phase,
      status: 'pending',
      startedAt: null,
      completedAt: null
    }));
    this.completedTasks = [];

    // Start real-time timer
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      this._updateInkRender();
    }, 1000);

    // Start Ink rendering
    this._startInkRender();

    return this;
  }

  /**
   * Start a new phase
   */
  startPhase(phaseName, total, options = {}) {
    this.currentPhase = {
      name: phaseName,
      total: total,
      current: 0,
      startTime: Date.now(),
      items: options.items || [],
      status: null,
      isDetailed: this.detailedPhases.includes(phaseName)
    };
    
    // Update TODO task status
    const taskIndex = this.todoTasks.findIndex(t => t.name === phaseName);
    if (taskIndex !== -1) {
      this.todoTasks[taskIndex].status = 'in_progress';
      this.todoTasks[taskIndex].startedAt = Date.now();
      
      // Mark previous tasks as completed if they were still pending
      for (let i = 0; i < taskIndex; i++) {
        if (this.todoTasks[i].status === 'pending') {
          this.todoTasks[i].status = 'completed';
          this.todoTasks[i].completedAt = Date.now();
        }
      }
    }

    // Reset phase details for detailed phases
    if (this.currentPhase.isDetailed) {
      this.phaseDetails = {
        currentItem: null,
        currentItemIndex: 0,
        totalItems: total,
        currentItemSize: 0,
        bytesProcessed: 0,
        phaseStartTime: Date.now(),
        lastUpdateTime: Date.now()
      };
    }

    this.stats.phases[phaseName] = {
      startTime: Date.now(),
      items: total,
      processed: 0
    };

    // Find current phase index
    this.currentPhaseIndex = this.phases.findIndex((p) => p === phaseName);

    // Update the Ink display
    this._updateInkRender();

    // Log to file only
    if (this.logger && this.logger.debug) {
      this.logger.debug(`Starting phase: ${phaseName}`);
    }
  }

  /**
   * Update progress for current phase
   */
  update(current, status = null, size = 0) {
    if (!this.isActive || !this.currentPhase) return;

    this.currentPhase.current = current;
    this.currentPhase.status = status;
    this.stats.processedItems += 1;
    this.stats.processedSizeBytes += size;

    // Update detailed phase tracking
    if (this.currentPhase.isDetailed) {
      this.phaseDetails.currentItemIndex = current;
      this.phaseDetails.bytesProcessed += size;
      this.phaseDetails.lastUpdateTime = Date.now();
      
      // Extract database name from status if available
      if (status) {
        const match = status.match(/(?:Exported|Imported|Exporting|Importing)\s+(.+)/);
        if (match) {
          this.phaseDetails.currentItem = match[1];
        }
      }
    }

    // Update the Ink display
    this._updateInkRender();

    // Log to file only
    if (status && this.logger && this.logger.debug) {
      this.logger.debug(`${this.currentPhase.name}: ${status}`);
    }
  }

  /**
   * Complete current phase
   */
  completePhase(summary = null) {
    if (!this.currentPhase) return;

    const elapsed = (Date.now() - this.currentPhase.startTime) / 1000;
    
    // Update TODO task status
    const taskIndex = this.todoTasks.findIndex(t => t.name === this.currentPhase.name);
    if (taskIndex !== -1) {
      this.todoTasks[taskIndex].status = 'completed';
      this.todoTasks[taskIndex].completedAt = Date.now();
      this.completedTasks.push(this.todoTasks[taskIndex]);
    }

    // Update stats
    this.stats.phases[this.currentPhase.name].endTime = Date.now();
    this.stats.phases[this.currentPhase.name].duration = elapsed;
    this.stats.phases[this.currentPhase.name].processed =
      this.currentPhase.current;

    // Add success message
    this.statusMessages.push({
      type: 'success',
      message: `${this.currentPhase.name} completed`,
      summary: summary,
      timestamp: Date.now()
    });

    // Keep only recent messages (auto-cleanup old ones)
    const recentCutoff = Date.now() - 5000; // Keep messages for 5 seconds
    this.statusMessages = this.statusMessages.filter(
      msg => msg.timestamp > recentCutoff
    );

    // Update the Ink display
    this._updateInkRender();

    // Log to file only
    if (summary && this.logger && this.logger.info) {
      this.logger.info(`✅ ${this.currentPhase.name}: ${summary}`);
    }

    this.currentPhase = null;
  }

  /**
   * Add a status message
   */
  status(message, type = 'info') {
    // Add status message to list
    this.statusMessages.push({
      type: type,
      message: message,
      timestamp: Date.now()
    });

    // Keep only recent messages
    const recentCutoff = Date.now() - 5000;
    this.statusMessages = this.statusMessages.filter(
      msg => msg.timestamp > recentCutoff
    );

    // Update the Ink display
    this._updateInkRender();

    // Log to file
    if (this.logger && this.logger.info) {
      this.logger.info(`${type}: ${message}`);
    }
  }

  /**
   * Complete all tracking and show final summary
   */
  complete(results) {
    if (!this.isActive) return;

    const totalDuration = (Date.now() - this.startTime) / 1000;

    // Clear timer interval
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Mark all remaining tasks as completed FIRST
    this.todoTasks.forEach(task => {
      if (task.status === 'pending' || task.status === 'in_progress') {
        task.status = 'completed';
        task.completedAt = Date.now();
      }
    });

    // Update state for completion
    this.isComplete = true;
    this.completionResults = {
      ...results,
      duration: this._formatTime(totalDuration),
      durationSeconds: totalDuration,
      totalSize: this._formatBytes(this.stats.processedSizeBytes),
      processedDatabases: results?.processedDatabases || this.stats.processedItems,
      successful: results?.successful || [],
      failed: results?.failed || [],
      sourceInstance: results?.sourceInstance,
      targetInstance: results?.targetInstance,
      databases: results?.databases || [],
      startTime: new Date(this.startTime).toLocaleTimeString(),
      endTime: new Date().toLocaleTimeString()
    };


    // IMPORTANT: Update the Ink display AFTER all state changes
    // Try multiple times if needed
    const tryUpdate = () => {
      if (this._updateProgressData) {
        this._updateProgressData();
        return true;
      }
      return false;
    };

    if (!tryUpdate()) {
      // If update function doesn't exist yet, wait a bit and try again
      setTimeout(() => {
        tryUpdate();
      }, 100);
    }

    // Also call the original update method
    this._updateInkRender();

    // Do NOT automatically unmount - let the InkApp control the lifecycle
    // The InkApp will handle when to unmount based on user interaction
    this.isActive = false;
  }

  /**
   * Update progress from external callback
   * This method bridges the gap between the tool callback and the internal progress tracking
   */
  updateProgress(progressInfo) {
    if (!progressInfo || !this.isActive) return;

    // Handle different progress info structures
    if (progressInfo.phase && progressInfo.phase !== this.currentPhase?.name) {
      // New phase started
      this.startPhase(progressInfo.phase, progressInfo.total || 100);
    }

    if (progressInfo.current !== undefined) {
      this.update(
        progressInfo.current,
        progressInfo.status,
        progressInfo.sizeBytes || 0
      );
    }

    if (progressInfo.message) {
      this.status(progressInfo.message, progressInfo.type || 'info');
    }
  }

  /**
   * Start predictive progress for database operations
   * @param {string} operation - 'export' or 'import'
   * @param {string} databaseName - Name of the database
   * @param {number} sizeBytes - Size of the database in bytes
   */
  startPredictiveProgress(operation, databaseName, sizeBytes) {
    if (!sizeBytes || sizeBytes === 0) {
      // For unknown sizes, use a default estimate
      sizeBytes = 50 * 1024 * 1024; // Default to 50MB
    }

    // Stop any existing predictive progress
    this.stopPredictiveProgress();

    // Calculate estimated duration based on throughput
    const throughput = operation === 'export' 
      ? this.performanceMetrics.exportThroughput 
      : this.performanceMetrics.importThroughput;
    
    // Add connection overhead and calculate total duration
    const transferTime = (sizeBytes / throughput) * 1000; // Convert to milliseconds
    const estimatedDuration = transferTime + this.performanceMetrics.connectionOverhead;

    // Initialize predictive progress state
    this.predictiveProgress = {
      isActive: true,
      interval: null,
      startTime: Date.now(),
      estimatedDuration: estimatedDuration,
      currentProgress: 0,
      targetProgress: 100,
      itemStartTime: Date.now(),
      itemSize: sizeBytes,
      speedHistory: [],
      lastSpeedUpdate: Date.now(),
      databaseName: databaseName,
      operation: operation,
      displayedSpeed: null,
      lastSpeedDisplayUpdate: null,
      displayedETA: Math.round(estimatedDuration / 1000),
      lastETADisplayUpdate: Date.now()
    };
    
    // Initialize current item progress to 0 immediately
    if (this.currentPhase && this.currentPhase.isDetailed) {
      this.phaseDetails.currentItemProgress = 0;
      this._updateInkRender();
    }

    // Start predictive updates
    this.predictiveProgress.interval = setInterval(() => {
      this._updatePredictiveProgress();
    }, 500); // Update every 500ms for smooth animation

    // Log the start of predictive progress
    if (this.logger && this.logger.debug) {
      this.logger.debug(`Started predictive progress for ${operation} of ${databaseName}`, {
        sizeBytes,
        estimatedDuration: Math.round(estimatedDuration / 1000) + 's'
      });
    }
  }

  /**
   * Stop predictive progress updates
   */
  stopPredictiveProgress() {
    if (this.predictiveProgress.isActive) {
      if (this.predictiveProgress.interval) {
        clearInterval(this.predictiveProgress.interval);
        this.predictiveProgress.interval = null;
      }
      this.predictiveProgress.isActive = false;
      
      // Set progress to 100% when stopping
      if (this.currentPhase && this.currentPhase.isDetailed) {
        this.phaseDetails.currentItemProgress = 100;
        this._updateInkRender();
      }
    }
  }

  /**
   * Update predictive progress
   * @private
   */
  _updatePredictiveProgress() {
    if (!this.predictiveProgress.isActive) return;

    const elapsed = Date.now() - this.predictiveProgress.startTime;
    const estimatedDuration = this.predictiveProgress.estimatedDuration;

    // Calculate progress with smooth curve (ease-out)
    let rawProgress = (elapsed / estimatedDuration) * 100;
    
    // Apply easing function for more realistic progress
    // Starts fast, slows down near the end
    if (rawProgress < 90) {
      // Normal progress with slight variation
      const variation = (Math.random() - 0.5) * this.performanceMetrics.speedVariation * 10;
      rawProgress = Math.min(rawProgress + variation, 89);
    } else {
      // Slow down significantly after 90%
      rawProgress = 90 + (rawProgress - 90) * 0.3;
      rawProgress = Math.min(rawProgress, 95); // Never go above 95% predictively
    }

    this.predictiveProgress.currentProgress = Math.max(0, Math.min(rawProgress, 95));

    // Update phase details for display
    if (this.currentPhase && this.currentPhase.isDetailed) {
      this.phaseDetails.currentItemProgress = this.predictiveProgress.currentProgress;
      
      // Calculate and update speed
      const bytesProcessed = (this.predictiveProgress.currentProgress / 100) * this.predictiveProgress.itemSize;
      const elapsedSeconds = elapsed / 1000;
      
      if (elapsedSeconds > 0) {
        const currentSpeed = bytesProcessed / elapsedSeconds;
        
        // Add to speed history (keep last 5 measurements)
        this.predictiveProgress.speedHistory.push(currentSpeed);
        if (this.predictiveProgress.speedHistory.length > 5) {
          this.predictiveProgress.speedHistory.shift();
        }
        
        // Calculate average speed
        const avgSpeed = this.predictiveProgress.speedHistory.reduce((a, b) => a + b, 0) / 
                        this.predictiveProgress.speedHistory.length;
        
        // Only update displayed speed every 2 seconds to reduce flicker
        const now = Date.now();
        if (!this.predictiveProgress.lastSpeedDisplayUpdate || 
            now - this.predictiveProgress.lastSpeedDisplayUpdate > 2000) {
          // Add small variation for realism but keep it stable
          const speedVariation = 1 + (Math.random() - 0.5) * this.performanceMetrics.speedVariation * 0.5;
          this.predictiveProgress.displayedSpeed = avgSpeed * speedVariation;
          this.predictiveProgress.lastSpeedDisplayUpdate = now;
        }
        
        // Use cached displayed speed
        this.phaseDetails.predictiveSpeed = this.predictiveProgress.displayedSpeed || avgSpeed;
      }

      // Update the display
      this._updateInkRender();
    }
  }

  /**
   * Stop tracking (in case of errors)
   */
  stop(error = null) {
    if (this.isActive) {
      // Clear timer interval
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      // Stop predictive progress
      this.stopPredictiveProgress();

      this.error = error;
      this._updateInkRender();

      // Stop Ink after a delay to show the error message
      setTimeout(() => {
        if (this.inkInstance) {
          this.inkInstance.unmount();
          this.inkInstance = null;
        }
      }, 2000);

      this.isActive = false;
    }
  }

  /**
   * Cleanup the progress tracker (called by InkApp when needed)
   */
  cleanup() {
    // Clear any timers
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Stop predictive progress
    this.stopPredictiveProgress();

    // Unmount Ink instance if it exists
    if (this.inkInstance) {
      this.inkInstance.unmount();
      this.inkInstance = null;
    }

    this.isActive = false;
  }

  // Private methods

  _startInkRender() {
    const self = this;
    
    // Clean up any existing instance first
    if (this.inkInstance) {
      try {
        this.inkInstance.unmount();
        this.inkInstance.clear();
        this.inkInstance.cleanup(); // Remove from instances map
      } catch (e) {
        // Ignore errors during cleanup
      }
      this.inkInstance = null;
    }
    
    const ProgressComponent = () => {
      const [progressData, setProgressData] = React.useState({
        isComplete: self.isComplete,
        error: self.error,
        currentPhase: self.currentPhase,
        elapsedSeconds: self.elapsedSeconds,
        statusMessages: self.statusMessages,
        completionResults: self.completionResults,
        todoTasks: self.todoTasks
      });

      // No longer need to handle "any key" - the selector handles actions

      React.useEffect(() => {
        // Store the update function for external updates
        self._updateProgressData = () => {
          setProgressData({
            isComplete: self.isComplete,
            error: self.error,
            currentPhase: self.currentPhase,
            elapsedSeconds: self.elapsedSeconds,
            statusMessages: self.statusMessages,
            completionResults: self.completionResults,
            todoTasks: self.todoTasks
          });
        };
      }, []);

      return React.createElement(
        Box,
        { flexDirection: 'column', gap: 1 },
        // Static header - renders once, no re-renders
        React.createElement(
          Static,
          { items: [{ id: 'header' }] },
          (item) => React.createElement(
            Box,
            { key: item.id, borderStyle: 'round', borderColor: '#F204F1', padding: 1 },
            React.createElement(
              Text,
              { bold: true },
              '🚀 CloudSQL PostgreSQL Migration Tool'
            )
          )
        ),
        
        // Recent status messages (auto-hide after 5 seconds)
        ...progressData.statusMessages.slice(-2).map((msg, idx) =>
          React.createElement(
            Box,
            { key: `msg-${idx}`, marginLeft: 2 },
            React.createElement(StatusMessage, {
              variant: msg.type === 'error' ? 'error' : 
                       msg.type === 'warning' ? 'warning' : 
                       msg.type === 'success' ? 'success' : 'info',
              children: msg.message
            })
          )
        ),
        
        // Show TODO list above main progress
        progressData.todoTasks && progressData.todoTasks.length > 0 && React.createElement(
          Box,
          { marginBottom: 1, marginLeft: 2 },
          React.createElement(TodoList, {
            tasks: progressData.todoTasks,
            title: null,
            showTimeline: true,
            maxVisible: 8
          })
        ),
        
        // Main progress display
        progressData.isComplete ? 
          // Completion state
          React.createElement(
            Box,
            { flexDirection: 'column', gap: 1 },
            // Show completion message with check mark
            React.createElement(
              Box,
              { gap: 2, marginBottom: 1 },
              React.createElement(
                Text,
                { color: '#7e9400', bold: true },
                '✓'
              ),
              React.createElement(
                Text,
                { color: '#7e9400', bold: true },
                'Migration completed successfully'
              ),
              React.createElement(
                Text,
                { dimColor: true },
                `(${self._formatTime(progressData.elapsedSeconds)})`
              )
            ),
            // Migration Summary
            React.createElement(
              Box,
              { flexDirection: 'column', marginTop: 2, borderStyle: 'round', borderColor: '#7e9400', padding: 1 },
              React.createElement(
                Text,
                { bold: true, color: '#7e9400' },
                '📊 Migration Summary'
              ),
              React.createElement(Box, { marginBottom: 1 }),
              // Results summary
              progressData.completionResults && React.createElement(
                Box,
                { flexDirection: 'column', gap: 1 },
                // Instance information
                progressData.completionResults.sourceInstance && React.createElement(
                  Text,
                  { color: 'cyan' },
                  `📦 Source: ${progressData.completionResults.sourceInstance}`
                ),
                progressData.completionResults.targetInstance && React.createElement(
                  Text,
                  { color: 'cyan' },
                  `📦 Target: ${progressData.completionResults.targetInstance}`
                ),
                React.createElement(Box, { marginTop: 1 }),
                // Database details
                progressData.completionResults.databases && progressData.completionResults.databases.length > 0 && React.createElement(
                  Box,
                  { flexDirection: 'column' },
                  React.createElement(
                    Text,
                    { color: 'white' },
                    `✓ Databases migrated (${progressData.completionResults.processedDatabases || progressData.completionResults.databases.length}):`
                  ),
                  ...progressData.completionResults.databases.slice(0, 5).map(db => 
                    React.createElement(
                      Text,
                      { key: db, color: 'gray', marginLeft: 2 },
                      `• ${db}`
                    )
                  ),
                  progressData.completionResults.databases.length > 5 && React.createElement(
                    Text,
                    { color: 'gray', marginLeft: 2 },
                    `• ... and ${progressData.completionResults.databases.length - 5} more`
                  )
                ),
                React.createElement(Box, { marginTop: 1 }),
                // Size and timing
                progressData.completionResults.totalSize && React.createElement(
                  Text,
                  null,
                  `💾 Total size: ${progressData.completionResults.totalSize}`
                ),
                progressData.completionResults.duration && React.createElement(
                  Text,
                  null,
                  `⏱️ Duration: ${progressData.completionResults.duration}`
                ),
                progressData.completionResults.startTime && React.createElement(
                  Text,
                  { color: 'gray' },
                  `Started: ${progressData.completionResults.startTime} | Ended: ${progressData.completionResults.endTime}`
                ),
                React.createElement(Box, { marginTop: 1 }),
                // Success/Failure counts
                progressData.completionResults.successful && React.createElement(
                  Text,
                  { color: '#7e9400' },
                  `✓ Successful: ${progressData.completionResults.successful.length || 0} operations`
                ),
                progressData.completionResults.failed && progressData.completionResults.failed.length > 0 && React.createElement(
                  Text,
                  { color: '#FF0000' },
                  `✗ Failed: ${progressData.completionResults.failed.length} operations`
                )
              )
            ),
            // Next actions selector
            React.createElement(NextActionsSelector, {
              onAction: (action) => {
                if (self.onUserContinue) {
                  self.onUserContinue(action);
                }
              }
            })
          ) :
        progressData.error ?
          // Error state
          React.createElement(StatusMessage, {
            variant: 'error',
            children: `Migration failed: ${progressData.error.message || progressData.error}`
          }) :
          // Active migration state
          React.createElement(
            Box,
            { flexDirection: 'column', gap: 1 },
            
            // Show detailed progress for Export/Import phases FIRST
            progressData.currentPhase && progressData.currentPhase.isDetailed && 
              React.createElement(
                Box,
                { flexDirection: 'column', gap: 1 },
                // Phase name
                React.createElement(
                  Text,
                  null,
                  `${progressData.currentPhase.name === 'Export' ? 'Exporting' : 'Importing'} databases`
                ),
                // Progress bar
                React.createElement(
                  Box,
                  { width: 50 },
                  React.createElement(CustomProgressBar, {
                    value: self._calculatePhaseProgress(), // ProgressBar expects 0-100
                    width: 30,
                    style: 'gradient',
                    showPercentage: true
                  })
                ),
                // Detailed status
                React.createElement(
                  Box,
                  { marginLeft: 2 },
                  React.createElement(
                    Text,
                    { dimColor: true },
                    `└─ ${self._getDetailedStatus()}`
                  )
                )
              ),
            
            // Show simple status for non-detailed phases (BEFORE spinner)
            progressData.currentPhase && !progressData.currentPhase.isDetailed && progressData.currentPhase.status &&
              React.createElement(
                Box,
                { marginLeft: 4, marginBottom: 1 },
                React.createElement(
                  Text,
                  { dimColor: true },
                  progressData.currentPhase.status
                )
              ),
            
            // Spinner at the very BOTTOM
            React.createElement(
              Box,
              { gap: 2, marginTop: 2 },
              React.createElement(ShimmerSpinner, {
                label: 'Migration in progress...',
                isVisible: true,
                status: 'running',
                baseColor: '#F204F1',
                glowSpeed: 100,
                glowWidth: 3
              }),
              React.createElement(
                Text,
                { dimColor: true },
                `(${self._formatTime(progressData.elapsedSeconds)})`
              )
            )
          )
      );
    };

    this.inkInstance = render(
      React.createElement(
        ThemeProvider,
        { theme: customTheme },
        React.createElement(ProgressComponent)
      )
    );
  }

  _updateInkRender() {
    if (this._updateProgressData) {
      // For completion state, always update immediately
      if (this.isComplete) {
        this._updateProgressData();
        this._lastUpdateTime = Date.now();
      } else {
        // Throttle updates to prevent excessive re-renders during progress
        if (!this._lastUpdateTime || Date.now() - this._lastUpdateTime > 100) {
          this._updateProgressData();
          this._lastUpdateTime = Date.now();
        }
      }
    } else {
    }
  }

  _calculatePhaseProgress() {
    if (!this.currentPhase || this.currentPhase.total === 0) return 0;
    
    // Use predictive progress if active
    if (this.predictiveProgress.isActive && this.phaseDetails.currentItemProgress !== undefined) {
      // Calculate overall progress: completed items + current item progress
      // currentPhase.current represents completed items when processing starts (0-based)
      const completedItems = this.currentPhase.current;
      const completedProgress = (completedItems / this.currentPhase.total) * 100;
      const currentItemContribution = (this.phaseDetails.currentItemProgress / 100) * (100 / this.currentPhase.total);
      const totalProgress = Math.min(100, Math.round(completedProgress + currentItemContribution));
      
      // Debug logging
      if (this.logger && this.logger.debug) {
        this.logger.debug(`Progress calculation: completed=${completedItems}/${this.currentPhase.total}, itemProgress=${this.phaseDetails.currentItemProgress.toFixed(1)}%, total=${totalProgress}%`);
      }
      
      return totalProgress;
    }
    
    // Fallback to regular calculation
    return Math.min(100, Math.round((this.currentPhase.current / this.currentPhase.total) * 100));
  }

  _getDetailedStatus() {
    if (!this.currentPhase || !this.currentPhase.isDetailed) return '';
    
    const parts = [];
    
    // Current item being processed
    if (this.phaseDetails.currentItem) {
      parts.push(this.phaseDetails.currentItem);
    }
    
    // Progress counter (display 1-based index)
    const displayIndex = Math.min(this.phaseDetails.currentItemIndex + 1, this.phaseDetails.totalItems);
    parts.push(`${displayIndex}/${this.phaseDetails.totalItems}`);
    
    // Speed calculation
    const speed = this._calculateSpeed();
    if (speed) {
      parts.push(speed);
    }
    
    // ETA calculation
    const eta = this._calculateETA();
    if (eta) {
      parts.push(eta);
    }
    
    return parts.join(' | ');
  }

  _calculateSpeed() {
    // Use predictive speed if available
    if (this.predictiveProgress.isActive && this.phaseDetails.predictiveSpeed) {
      return this._formatBytes(this.phaseDetails.predictiveSpeed) + '/s';
    }
    
    // Fallback to actual speed calculation
    if (!this.phaseDetails.phaseStartTime || this.phaseDetails.bytesProcessed === 0) {
      return null;
    }
    
    const elapsedSeconds = (Date.now() - this.phaseDetails.phaseStartTime) / 1000;
    if (elapsedSeconds === 0) return null;
    
    const bytesPerSecond = this.phaseDetails.bytesProcessed / elapsedSeconds;
    return this._formatBytes(bytesPerSecond) + '/s';
  }

  _calculateETA() {
    if (!this.currentPhase || !this.phaseDetails.phaseStartTime) {
      return null;
    }
    
    // Use predictive ETA if available
    if (this.predictiveProgress.isActive) {
      const elapsed = Date.now() - this.predictiveProgress.startTime;
      const remaining = Math.max(0, this.predictiveProgress.estimatedDuration - elapsed);
      let remainingSeconds = Math.round(remaining / 1000);
      
      if (remainingSeconds > 0) {
        // Round to nearest 5 seconds to reduce jitter
        if (remainingSeconds > 30) {
          remainingSeconds = Math.round(remainingSeconds / 5) * 5;
        }
        
        // Only update displayed ETA if it changed significantly (more than 2 seconds)
        const now = Date.now();
        if (!this.predictiveProgress.displayedETA ||
            !this.predictiveProgress.lastETADisplayUpdate ||
            now - this.predictiveProgress.lastETADisplayUpdate > 3000 ||
            Math.abs(remainingSeconds - this.predictiveProgress.displayedETA) > 2) {
          this.predictiveProgress.displayedETA = remainingSeconds;
          this.predictiveProgress.lastETADisplayUpdate = now;
        }
        
        return '~' + this._formatTime(this.predictiveProgress.displayedETA) + ' remaining';
      }
    }
    
    // Fallback to actual calculation
    const processed = this.phaseDetails.currentItemIndex;
    const total = this.phaseDetails.totalItems;
    
    if (processed === 0 || processed >= total) return null;
    
    const elapsedSeconds = (Date.now() - this.phaseDetails.phaseStartTime) / 1000;
    const avgSecondsPerItem = elapsedSeconds / processed;
    const remainingItems = total - processed;
    const remainingSeconds = Math.round(avgSecondsPerItem * remainingItems);
    
    return '~' + this._formatTime(remainingSeconds) + ' remaining';
  }

  _formatTime(seconds) {
    if (!seconds || seconds === Infinity || isNaN(seconds)) return '00:00';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }

  _formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

export default ModernProgressTracker;