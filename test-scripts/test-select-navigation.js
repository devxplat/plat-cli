#!/usr/bin/env node

/**
 * Test the SimpleSelect navigation in SelectPrompt
 */

import SelectPrompt from '../src/interfaces/common/prompts/SelectPrompt.js';
import chalk from 'chalk';

async function test() {
  console.log(chalk.cyan('Testing SimpleSelect navigation in SelectPrompt:\n'));
  console.log(chalk.gray('Use ↑↓ arrow keys to navigate, Enter to select\n'));

  const result = await SelectPrompt.prompt({
    message: '⚠️ This will migrate data between CloudSQL instances. Continue?',
    choices: [
      { label: '❌ No, cancel operation', value: false },
      { label: '✅ Yes, proceed with migration', value: true }
    ],
    defaultValue: false
  });

  console.log(
    chalk.green(`\nYou selected: ${result ? 'Yes, proceed' : 'No, cancel'}`)
  );
  process.exit(0);
}

test().catch(console.error);
