#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  // Get package version
  const packagePath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const version = packageJson.version;
  const packageName = packageJson.name;

  console.log(`📦 Installing ${packageName}@${version} globally...`);

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
