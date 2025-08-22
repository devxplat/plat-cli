#!/usr/bin/env node

import { mkdirSync, writeFileSync, existsSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const binDir = join(rootDir, 'bin');
const binFile = join(binDir, 'plat-cli');

// Create bin directory if it doesn't exist
if (!existsSync(binDir)) {
  mkdirSync(binDir, { recursive: true });
  console.log('📁 Created bin directory');
}

// Create executable file with LF line endings
const binContent = `#!/usr/bin/env node

// Import CLI Router to handle mode detection and routing
import CLIRouter from '../src/interfaces/cli-router.js';

// Main entry point for plat-cli
async function main() {
  try {
    // Create CLI router instance
    const router = new CLIRouter();
    
    // Get command line arguments (skip 'node' and script name)
    const args = process.argv.slice(2);
    
    // Route to appropriate CLI interface
    await router.route(args);
  } catch (error) {
    console.error('CLI startup error:', error.message);
    process.exit(1);
  }
}

// Start the CLI
main();
`;

// Write file with explicit LF line endings
writeFileSync(binFile, binContent.replace(/\r\n/g, '\n'));

// Make executable on Unix-like systems
if (platform() !== 'win32') {
  try {
    chmodSync(binFile, 0o755);
    console.log('🔧 Made bin/plat-cli executable (chmod +x)');
  } catch (error) {
    // Ignore chmod errors on Windows
  }
}

console.log('✅ Created bin/plat-cli executable');