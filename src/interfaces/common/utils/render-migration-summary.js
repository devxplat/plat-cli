import React from 'react';
import { render } from 'ink';
import MigrationSummary from '../components/MigrationSummary.js';

/**
 * Renders the MigrationSummary component to the console
 * Used by Classic CLI to display consistent migration summaries
 */
export const renderMigrationSummary = (result, config, isBatch = false) => {
  const component = React.createElement(MigrationSummary, {
    result,
    config,
    isBatch
  });

  // Render the component and immediately unmount
  // This displays the static summary without keeping the app running
  const app = render(component);
  
  // Small delay to ensure render completes
  setTimeout(() => {
    app.unmount();
  }, 100);
};

export default renderMigrationSummary;