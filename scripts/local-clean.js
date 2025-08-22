#!/usr/bin/env node

import { unlinkSync, readdirSync } from 'fs';
import { join } from 'path';

try {
  const cwd = process.cwd();
  const files = readdirSync(cwd);
  
  const tgzFiles = files.filter(file => 
    file.startsWith('plat-cli-') && file.endsWith('.tgz')
  );
  
  if (tgzFiles.length === 0) {
    console.log('✅ No .tgz files to clean');
  } else {
    tgzFiles.forEach(file => {
      unlinkSync(join(cwd, file));
      console.log(`🗑️  Removed ${file}`);
    });
    console.log(`✅ Cleaned ${tgzFiles.length} .tgz file(s)`);
  }
} catch (error) {
  console.error('❌ Error during cleanup:', error.message);
  process.exit(1);
}