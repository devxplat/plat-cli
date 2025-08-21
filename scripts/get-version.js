#!/usr/bin/env node

// Simple cross-platform script to get package version
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const packagePath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  console.log(packageJson.version);
} catch (error) {
  console.error('Error reading package.json:', error.message);
  process.exit(1);
}
