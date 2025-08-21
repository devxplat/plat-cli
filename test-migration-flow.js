#!/usr/bin/env node

/**
 * Test script for migration flow with TODO list and completion display
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing migration flow with TODO list and completion display...\n');

// Start the CLI in interactive mode
const cli = spawn('node', ['index.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    DEBUG: 'plat-cli:*'
  }
});

cli.on('error', (err) => {
  console.error('Failed to start CLI:', err);
  process.exit(1);
});

cli.on('exit', (code) => {
  console.log(`\nCLI exited with code ${code}`);
  process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  cli.kill('SIGINT');
});