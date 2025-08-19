import { select } from '@inquirer/prompts';
import chalk from 'chalk';

/**
 * Standalone Select Prompt using Inquirer
 * Can be used in classic CLI mode for consistent UI
 */
class SelectPrompt {
  /**
   * Show a select prompt and return the selected value
   * @param {Object} options - Prompt options
   * @param {string} options.message - The prompt message
   * @param {Array} options.choices - Array of choices [{label, value}]
   * @param {*} options.defaultValue - Default selected value
   * @returns {Promise} - Resolves with the selected value
   */
  static async prompt({ message, choices, defaultValue }) {
    // Check if we're in a TTY environment that supports raw mode
    const isInteractive = process.stdin.isTTY && process.stdin.setRawMode;
    
    if (!isInteractive) {
      // Fallback to simple console-based selection for non-TTY environments
      console.log(chalk.yellow(message));
      console.log('');
      choices.forEach((choice, index) => {
        const isDefault = choice.value === defaultValue;
        const prefix = isDefault ? '>' : ' ';
        console.log(`${prefix} ${choice.label}`);
      });
      console.log('');
      console.log(chalk.gray('(Using default selection in non-interactive mode)'));
      return Promise.resolve(defaultValue);
    }

    // Convert choices to inquirer format
    const inquirerChoices = choices.map(choice => ({
      name: choice.label,
      value: choice.value,
      disabled: choice.disabled
    }));

    // Use inquirer select prompt
    const answer = await select({
      message: message,
      choices: inquirerChoices,
      default: defaultValue
    });

    return answer;
  }
}

export default SelectPrompt;