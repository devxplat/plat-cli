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
const binContent = `#!/usr/bin/env node\n\nimport '../index.js';\n`;

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