/**
 * Project History Manager
 * Manages recently used GCP project names for autocomplete functionality
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

class ProjectHistoryManager {
  constructor() {
    this.maxHistory = 20;
    this.historyFile = this.getHistoryFilePath();
    this.history = this.loadHistory();
  }

  /**
   * Get XDG-compliant cache directory for history file
   */
  getHistoryFilePath() {
    const cacheHome = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
    const cacheDir = path.join(cacheHome, 'plat-cli');
    
    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    return path.join(cacheDir, 'project-history.json');
  }

  /**
   * Load project history from file
   */
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf8');
        const parsed = JSON.parse(data);
        return parsed.projects || [];
      }
    } catch (error) {
      // Silent fail - history is not critical
    }
    return [];
  }

  /**
   * Save project history to file
   */
  saveHistory() {
    try {
      const data = {
        projects: this.history,
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2));
    } catch (error) {
      // Silent fail - history is not critical
    }
  }

  /**
   * Add a project to history
   * @param {string} projectId - GCP project ID
   */
  addProject(projectId) {
    if (!projectId || typeof projectId !== 'string') return;
    
    // Remove if already exists (to move to front)
    this.history = this.history.filter(p => p !== projectId);
    
    // Add to front
    this.history.unshift(projectId);
    
    // Keep only max history
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }
    
    this.saveHistory();
  }

  /**
   * Get recent projects for autocomplete
   * @param {string} prefix - Optional prefix to filter by
   * @returns {string[]} List of project IDs
   */
  getRecentProjects(prefix = '') {
    if (!prefix) return this.history;
    
    const lowerPrefix = prefix.toLowerCase();
    return this.history.filter(project => 
      project.toLowerCase().startsWith(lowerPrefix)
    );
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.history = [];
    this.saveHistory();
  }

  /**
   * Remove a specific project from history
   * @param {string} projectId - GCP project ID to remove
   */
  removeProject(projectId) {
    this.history = this.history.filter(p => p !== projectId);
    this.saveHistory();
  }
}

// Export singleton instance
export default new ProjectHistoryManager();