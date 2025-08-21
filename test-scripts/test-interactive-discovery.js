#!/usr/bin/env node

/**
 * Teste da interface interativa com discovery
 * Para simular o que acontece quando abre o menu interativo
 */

import React from 'react';
import ProjectScanner from '../src/interfaces/interactiveCLI/components/ProjectScanner.js';
import { render } from 'ink';

// Criar um mock test para o ProjectScanner component
function TestApp() {
  const [result, setResult] = React.useState(null);
  const [cancelled, setCancelled] = React.useState(false);

  const handleComplete = (scanResult) => {
    console.log('\n🎉 ProjectScanner completed with result:');
    console.log(JSON.stringify(scanResult, null, 2));
    setResult(scanResult);
    process.exit(0);
  };

  const handleCancel = () => {
    console.log('\n❌ ProjectScanner cancelled');
    setCancelled(true);
    process.exit(0);
  };

  if (result) {
    return React.createElement('text', { color: 'green' }, 'Test completed!');
  }

  if (cancelled) {
    return React.createElement('text', { color: 'red' }, 'Test cancelled!');
  }

  // Render the ProjectScanner
  return React.createElement(ProjectScanner, {
    label: 'Test Source Project Discovery',
    onComplete: handleComplete,
    onCancel: handleCancel,
    allowMultiple: true,
    isSource: true
  });
}

// Set up test environment
process.env.VERBOSE = 'true';

console.log('🧪 Testing Interactive Discovery Interface');
console.log('==========================================');
console.log(
  'This will test the ProjectScanner component with real GCP discovery.'
);
console.log('You should see:');
console.log('1. Loading spinner while discovering projects');
console.log('2. Project input field with autocomplete');
console.log('3. Instance scanning when you enter a valid project');
console.log('');
console.log('💡 Press Ctrl+C to exit the test at any time');
console.log('💡 Press ESC to go back to input from any screen');
console.log('💡 Press Ctrl+U to refresh project cache');
console.log('');

// Small delay before starting
setTimeout(() => {
  const app = render(React.createElement(TestApp));

  // Handle cleanup
  process.on('SIGINT', () => {
    console.log('\n👋 Test interrupted by user');
    app.unmount();
    process.exit(0);
  });
}, 1000);
