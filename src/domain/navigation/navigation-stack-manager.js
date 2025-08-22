/**
 * NavigationStackManager
 * Manages a unified navigation stack for complex multi-step forms with nested components
 */
class NavigationStackManager {
  constructor() {
    this.stack = [];
    this.listeners = new Set();
  }

  /**
   * Push a new navigation state onto the stack
   * @param {Object} state - The navigation state to push
   * @param {string} state.component - Component name (e.g., 'ConfigurationForm', 'ProjectScanner')
   * @param {string} state.step - Current step identifier
   * @param {string} state.subStep - Sub-step within the component (e.g., 'input', 'selection', 'databases')
   * @param {Object} state.data - Component-specific state data
   * @param {Object} state.metadata - Additional metadata (step numbers, labels, etc.)
   */
  push(state) {
    // Create a deep copy to prevent mutation
    const stateCopy = {
      component: state.component,
      step: state.step,
      subStep: state.subStep,
      data: JSON.parse(JSON.stringify(state.data || {})),
      metadata: JSON.parse(JSON.stringify(state.metadata || {})),
      timestamp: Date.now()
    };
    
    this.stack.push(stateCopy);
    this.notifyListeners('push', stateCopy);
  }

  /**
   * Pop the most recent state from the stack
   * @returns {Object|null} The popped state or null if stack is empty
   */
  pop() {
    if (this.stack.length === 0) {
      return null;
    }
    
    const state = this.stack.pop();
    this.notifyListeners('pop', state);
    return state;
  }

  /**
   * Peek at the current (top) state without removing it
   * @returns {Object|null} The current state or null if stack is empty
   */
  peek() {
    if (this.stack.length === 0) {
      return null;
    }
    return this.stack[this.stack.length - 1];
  }

  /**
   * Get the previous state without removing anything from the stack
   * @returns {Object|null} The previous state or null if not available
   */
  getPrevious() {
    if (this.stack.length < 2) {
      return null;
    }
    return this.stack[this.stack.length - 2];
  }

  /**
   * Replace the current state with a new one (useful for updates without navigation)
   * @param {Object} state - The new state to replace with
   */
  replace(state) {
    if (this.stack.length === 0) {
      this.push(state);
      return;
    }
    
    const stateCopy = {
      component: state.component,
      step: state.step,
      subStep: state.subStep,
      data: JSON.parse(JSON.stringify(state.data || {})),
      metadata: JSON.parse(JSON.stringify(state.metadata || {})),
      timestamp: Date.now()
    };
    
    this.stack[this.stack.length - 1] = stateCopy;
    this.notifyListeners('replace', stateCopy);
  }

  /**
   * Clear the entire navigation stack
   */
  clear() {
    this.stack = [];
    this.notifyListeners('clear', null);
  }

  /**
   * Get the size of the navigation stack
   * @returns {number} The number of states in the stack
   */
  size() {
    return this.stack.length;
  }

  /**
   * Check if we can go back
   * @returns {boolean} True if there's at least one state to go back to
   */
  canGoBack() {
    return this.stack.length > 1;
  }

  /**
   * Get a specific navigation path (useful for breadcrumbs)
   * @returns {Array} Array of step labels from the stack
   */
  getNavigationPath() {
    return this.stack.map(state => ({
      component: state.component,
      step: state.step,
      subStep: state.subStep,
      label: state.metadata?.label || state.step
    }));
  }

  /**
   * Find the most recent state for a specific component
   * @param {string} component - Component name to search for
   * @returns {Object|null} The most recent state for that component or null
   */
  findComponentState(component) {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i].component === component) {
        return this.stack[i];
      }
    }
    return null;
  }

  /**
   * Navigate back to a specific component/step
   * @param {string} component - Component to navigate to
   * @param {string} step - Optional step within the component
   * @returns {Array} Array of popped states
   */
  navigateTo(component, step = null) {
    const poppedStates = [];
    
    while (this.stack.length > 0) {
      const current = this.peek();
      if (current.component === component && (!step || current.step === step)) {
        break;
      }
      poppedStates.push(this.pop());
    }
    
    return poppedStates;
  }

  /**
   * Register a listener for navigation events
   * @param {Function} listener - Callback function (event, state) => void
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Remove a registered listener
   * @param {Function} listener - The listener to remove
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of a navigation event
   * @param {string} event - Event type ('push', 'pop', 'replace', 'clear')
   * @param {Object} state - The state associated with the event
   */
  notifyListeners(event, state) {
    this.listeners.forEach(listener => {
      try {
        listener(event, state);
      } catch (error) {
        console.error('Navigation listener error:', error);
      }
    });
  }

  /**
   * Debug method to print the current stack
   */
  debug() {
    console.log('Navigation Stack:');
    this.stack.forEach((state, index) => {
      console.log(`  [${index}] ${state.component} > ${state.step}${state.subStep ? ' > ' + state.subStep : ''}`);
    });
  }

  /**
   * Create a navigation context for child components
   * @returns {Object} Navigation context with bound methods
   */
  createContext() {
    return {
      push: this.push.bind(this),
      pop: this.pop.bind(this),
      peek: this.peek.bind(this),
      replace: this.replace.bind(this),
      canGoBack: this.canGoBack.bind(this),
      navigateTo: this.navigateTo.bind(this),
      getNavigationPath: this.getNavigationPath.bind(this)
    };
  }
}

// Export as singleton to ensure consistent state across the application
let instance = null;

export const getNavigationStackManager = () => {
  if (!instance) {
    instance = new NavigationStackManager();
  }
  return instance;
};

export const resetNavigationStackManager = () => {
  if (instance) {
    instance.clear();
  }
  instance = new NavigationStackManager();
  return instance;
};

export default NavigationStackManager;