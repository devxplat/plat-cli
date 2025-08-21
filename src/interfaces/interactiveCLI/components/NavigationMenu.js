import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { colorPalettes } from '../theme/custom-theme.js';
import SimpleSelect from './SimpleSelect.js';
import { 
  getNavigationItems, 
  getBreadcrumbs 
} from '../../../domain/navigation/navigation-registry.js';

/**
 * Hierarchical Navigation Menu Component
 * Provides consistent navigation experience across the TUI
 */
const NavigationMenu = ({ 
  path = [], 
  onNavigate, 
  onSelectTool, 
  onBack, 
  onExit 
}) => {
  // Initialize with navigation items immediately
  const [menuItems, setMenuItems] = useState(() => getNavigationItems(path));
  const [breadcrumbs, setBreadcrumbs] = useState(() => getBreadcrumbs(path));
  const [error, setError] = useState(null);

  // Handle ESC key for navigation back
  useInput((input, key) => {
    if (key.escape && path.length > 0) {
      onBack();
    }
  });

  useEffect(() => {
    try {
      // Get items for current navigation level
      const items = getNavigationItems(path);
      setMenuItems(items);
      
      // Get breadcrumb trail
      const crumbs = getBreadcrumbs(path);
      setBreadcrumbs(crumbs);
    } catch (err) {
      setError(`Failed to load navigation: ${err.message}`);
    }
  }, [path]);

  const handleSelection = (value) => {
    if (value === 'exit') {
      onExit();
    } else {
      // Find selected item
      const selectedItem = menuItems.find(item => item.key === value);
      
      if (selectedItem) {
        if (selectedItem.isAction && selectedItem.toolName) {
          // This is a final action, trigger tool selection
          onSelectTool(selectedItem.toolName);
        } else if (selectedItem.hasChildren) {
          // Navigate to submenu
          onNavigate([...path, selectedItem.key]);
        }
      }
    }
  };

  if (error) {
    return React.createElement(
      Box,
      { flexDirection: 'column', gap: 1 },
      React.createElement(
        Text,
        { color: colorPalettes.classyPalette[4] },
        error
      )
    );
  }

  // Build menu options
  const options = [];
  
  // Add navigation items
  menuItems.forEach(item => {
    const label = item.icon ? `${item.icon} ${item.label}` : item.label;
    options.push({
      label: label,
      value: item.key,
      description: item.description
    });
  });

  // Back is handled by ESC key, no need for menu option

  // Add exit option
  options.push({
    label: 'Exit',
    value: 'exit'
  });

  // Build breadcrumb display
  const breadcrumbText = breadcrumbs.length > 0 
    ? breadcrumbs.map(b => b.label).join(' > ')
    : 'Main Menu';

  return React.createElement(
    Box,
    { flexDirection: 'column', gap: 1 },
    // Title with breadcrumbs
    React.createElement(
      Text,
      { color: colorPalettes.dust.primary },
      `🚀 DevX Plat-CLI${breadcrumbs.length > 0 ? ' > ' + breadcrumbText : ''}`
    ),
    // Instruction text
    React.createElement(
      Text,
      { color: colorPalettes.dust.secondary },
      path.length === 0 ? 'Select Provider:' : 'Select Option:'
    ),
    // Menu selector
    React.createElement(SimpleSelect, {
      key: `nav-${path.join('-')}-${menuItems.length}`, // Force React to recreate component on navigation
      options: options,
      onSubmit: handleSelection,
      defaultValue: null,
      showDescription: true,
      showNavigationHints: false // NavigationMenu shows its own complete hints
    }),
    // Help text
    React.createElement(
      Text,
      { color: '#ac8500' },
      path.length > 0
        ? 'ESC: back • Q or Ctrl+X: quit • ↑↓: navigate • Enter: select'
        : 'Q or Ctrl+X: quit • ↑↓: navigate • Enter: select'
    )
  );
};

export default NavigationMenu;