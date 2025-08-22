#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

try {
  // Get package version
  const packagePath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const version = packageJson.version;
  const packageName = packageJson.name;

  console.log(`📦 Installing ${packageName}@${version} globally...`);
  
  // Ensure bin directory and file exist
  const binDir = join(process.cwd(), 'bin');
  const binFile = join(binDir, 'plat-cli');
  
  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
    console.log('📁 Created bin directory');
  }
  
  if (!existsSync(binFile)) {
    const binContent = `#!/usr/bin/env node\n\nimport '../index.js';`;
    writeFileSync(binFile, binContent);
    console.log('✅ Created bin/plat-cli executable');
  }

  // Build package first
  console.log('🔨 Building package...');
  execSync('npm pack', { stdio: 'inherit' });

  // Install globally
  const tarballName = `${packageName}-${version}.tgz`;
  console.log(`📥 Installing ${tarballName}...`);
  execSync(`npm install -g ${tarballName}`, { stdio: 'inherit' });

  console.log(`✅ Successfully installed ${packageName}@${version} globally!`);
} catch (error) {
  console.error('❌ Error during local install:', error.message);
  process.exit(1);
}
