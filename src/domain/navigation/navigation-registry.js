/**
 * Navigation Registry
 * Centralized navigation structure for both Classic CLI and TUI interfaces
 * Ensures consistency across different interaction modes
 */

/**
 * Navigation hierarchy structure
 * Provider → Service → Action
 */
const navigationStructure = {
  'gcp': {
    label: 'Google Cloud Platform',
    description: 'GCP operations and tools',
    icon: '☁️',
    children: {
      'cloudsql-migrate': {
        // Combined service/action for simplicity as requested
        label: 'CloudSQL / Migrate',
        description: 'Migrate PostgreSQL databases between CloudSQL instances',
        icon: '🗄️',
        toolName: 'gcp.cloudsql.migrate',
        isAction: true // Indicates this is a final action, not a submenu
      }
      // Future services can be added here:
      // 'compute': { ... },
      // 'storage': { ... },
      // 'kubernetes': { ... }
    }
  }
  // Future providers can be added here:
  // 'aws': { ... },
  // 'azure': { ... },
  // 'kubernetes': { ... }
};

/**
 * Get the complete navigation structure
 * @returns {Object} Navigation hierarchy
 */
export const getNavigationStructure = () => {
  return navigationStructure;
};

/**
 * Get navigation items for a specific level
 * @param {Array<string>} path - Current navigation path
 * @returns {Array} Array of navigation items
 */
export const getNavigationItems = (path = []) => {
  let current = navigationStructure;
  
  // Navigate to the current level
  for (const segment of path) {
    if (current[segment] && current[segment].children) {
      current = current[segment].children;
    } else {
      return [];
    }
  }
  
  // Convert to array format for menu display
  return Object.entries(current).map(([key, value]) => ({
    key,
    label: value.label,
    description: value.description,
    icon: value.icon || '',
    isAction: value.isAction || false,
    toolName: value.toolName || null,
    hasChildren: !!value.children && !value.isAction
  }));
};

/**
 * Get breadcrumb trail for current navigation
 * @param {Array<string>} path - Current navigation path
 * @returns {Array} Breadcrumb items
 */
export const getBreadcrumbs = (path = []) => {
  const breadcrumbs = [];
  let current = navigationStructure;
  
  for (const segment of path) {
    if (current[segment]) {
      breadcrumbs.push({
        key: segment,
        label: current[segment].label,
        icon: current[segment].icon
      });
      
      if (current[segment].children) {
        current = current[segment].children;
      }
    }
  }
  
  return breadcrumbs;
};

/**
 * Get tool name for a navigation path
 * @param {Array<string>} path - Navigation path
 * @returns {string|null} Tool name or null if not an action
 */
export const getToolNameForPath = (path = []) => {
  let current = navigationStructure;
  
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    if (current[segment]) {
      if (current[segment].toolName) {
        return current[segment].toolName;
      }
      if (current[segment].children) {
        current = current[segment].children;
      }
    }
  }
  
  return null;
};

/**
 * Parse Classic CLI command to navigation path
 * @param {Array<string>} args - CLI arguments (e.g., ['gcp', 'cloudsql', 'migrate'])
 * @returns {Array<string>} Navigation path
 */
export const parseCliToPath = (args = []) => {
  const path = [];
  
  // Handle the special case of 'cloudsql migrate' → 'cloudsql-migrate'
  if (args[0] === 'gcp' && args[1] === 'cloudsql' && args[2] === 'migrate') {
    return ['gcp', 'cloudsql-migrate'];
  }
  
  // Future: Handle other path mappings as needed
  
  return path;
};

/**
 * Convert navigation path to CLI command
 * @param {Array<string>} path - Navigation path
 * @returns {string} CLI command
 */
export const pathToCliCommand = (path = []) => {
  const parts = ['plat-cli'];
  
  // Handle special case of 'cloudsql-migrate' → 'cloudsql migrate'
  if (path[0] === 'gcp' && path[1] === 'cloudsql-migrate') {
    parts.push('gcp', 'cloudsql', 'migrate');
  } else {
    parts.push(...path);
  }
  
  return parts.join(' ');
};

/**
 * Validate if a path exists in the navigation structure
 * @param {Array<string>} path - Navigation path to validate
 * @returns {boolean} True if path is valid
 */
export const isValidPath = (path = []) => {
  let current = navigationStructure;
  
  for (const segment of path) {
    if (current[segment]) {
      if (current[segment].children) {
        current = current[segment].children;
      }
    } else {
      return false;
    }
  }
  
  return true;
};

/**
 * Get all available tool paths
 * @returns {Array} Array of {path, toolName} objects
 */
export const getAllToolPaths = () => {
  const tools = [];
  
  const traverse = (node, path = []) => {
    Object.entries(node).forEach(([key, value]) => {
      const currentPath = [...path, key];
      
      if (value.toolName) {
        tools.push({
          path: currentPath,
          toolName: value.toolName,
          label: value.label,
          description: value.description
        });
      }
      
      if (value.children) {
        traverse(value.children, currentPath);
      }
    });
  };
  
  traverse(navigationStructure);
  return tools;
};

export default {
  getNavigationStructure,
  getNavigationItems,
  getBreadcrumbs,
  getToolNameForPath,
  parseCliToPath,
  pathToCliCommand,
  isValidPath,
  getAllToolPaths
};