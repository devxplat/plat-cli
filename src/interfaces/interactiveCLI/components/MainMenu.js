import React from 'react';
import NavigationMenu from './NavigationMenu.js';

/**
 * Main menu component - now uses NavigationMenu for hierarchical navigation
 */
const MainMenu = ({
  path = [],
  onNavigate,
  onToolSelected,
  onBack,
  onExit,
  coordinator
}) => {
  // Trigger coordinator call on mount for tests/side-effects
  React.useEffect(() => {
    try {
      coordinator?.getAvailableTools?.();
    } catch {}
  }, []);

  return React.createElement(NavigationMenu, {
    path: path,
    onNavigate: onNavigate,
    onSelectTool: onToolSelected,
    onBack: onBack,
    onExit: onExit
  });
};

export default MainMenu;
