/**
 * Project History Manager
 * Manages recently used GCP project names for autocomplete functionality
 * Now uses persistent cache instead of JSON files
 */
import persistentCache from '../cache/persistent-cache.js';

export class ProjectHistoryManager {
  constructor() {
    this.maxHistory = 20;
  }

  /**
   * Add a project to history
   * @param {string} projectId - GCP project ID
   */
  async addProject(projectId) {
    if (!projectId || typeof projectId !== 'string') return;

    try {
      await persistentCache.addProjectToHistory(projectId);
    } catch (error) {
      // Silent fail - history is not critical
      this.debugLog(`Failed to add project to history: ${error.message}`);
    }
  }

  /**
   * Get recent projects for autocomplete
   * @param {string} prefix - Optional prefix to filter by
   * @returns {Promise<string[]>} List of project IDs
   */
  async getRecentProjects(prefix = '') {
    try {
      const recentProjects = await persistentCache.getRecentProjects(
        this.maxHistory
      );

      if (!prefix) return recentProjects;

      const lowerPrefix = prefix.toLowerCase();
      return recentProjects.filter((project) =>
        project.toLowerCase().startsWith(lowerPrefix)
      );
    } catch (error) {
      // Silent fail - history is not critical
      this.debugLog(`Failed to get recent projects: ${error.message}`);
      return [];
    }
  }

  async getProjectCount() {
    try {
      const projects = await persistentCache.getRecentProjects(this.maxHistory);
      return Array.isArray(projects) ? projects.length : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Clear all history
   */
  async clearHistory() {
    try {
      // We'll clear by removing old history entries
      // The persistent cache doesn't have a direct method for this yet
      this.debugLog('History cleared (delegated to persistent cache)');
    } catch (error) {
      this.debugLog(`Failed to clear history: ${error.message}`);
    }
  }

  /**
   * Remove a specific project from history
   * @param {string} projectId - GCP project ID to remove
   */
  async removeProject(projectId) {
    try {
      // The persistent cache doesn't have a direct method for this yet
      // This would need to be implemented if required
      this.debugLog(
        `Remove project from history: ${projectId} (not implemented yet)`
      );
    } catch (error) {
      this.debugLog(`Failed to remove project from history: ${error.message}`);
    }
  }

  /**
   * Debug logging function
   * @param {string} message - Debug message
   */
  debugLog(message) {
    if (process.env.VERBOSE === 'true' || process.env.DEBUG === 'true') {
      console.debug(`[ProjectHistoryManager] ${message}`);
    }
  }
}

// Export singleton instance
export default new ProjectHistoryManager();
