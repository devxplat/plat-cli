/**
 * CLI Router - Handles mode detection and routing
 * Determines whether to use Interactive or Classic CLI based on arguments
 */
import chalk from 'chalk';
import configManager from '../infrastructure/config/config-manager.js';

class CLIRouter {
  constructor() {
    this.classicCommands = [
      'migrate',
      'validate',
      'list',
      'help',
      'version',
      'tools',
      'test-connection',
      'list-databases',
      '--help',
      '-h',
      '--version',
      '-v',
      '--config',
      '--dry-run',
      'gcp',
      'cloudsql',
      'database'
    ];

    this.forceInteractiveFlags = ['--interactive', '--ui', 'interactive', 'ui'];
  }

  /**
   * Determine which CLI mode to use based on arguments
   * @param {string[]} argv - Command line arguments (without node and script path)
   * @returns {Object} - { mode: 'interactive'|'classic', args: string[] }
   */
  detectMode(argv) {
    // Force interactive mode flags
    const forceInteractive = argv.some((arg) =>
      this.forceInteractiveFlags.includes(arg)
    );

    // Check if any classic CLI commands are present
    const hasClassicCommand = argv.some((arg) =>
      this.classicCommands.some(
        (cmd) => arg.startsWith(cmd) || arg.includes(cmd)
      )
    );

    // Default to interactive mode if no arguments or forced interactive
    const shouldUseInteractive =
      argv.length === 0 || forceInteractive || !hasClassicCommand;

    return {
      mode: shouldUseInteractive ? 'interactive' : 'classic',
      args: argv
    };
  }

  /**
   * Route to the appropriate CLI interface
   * @param {string[]} argv - Command line arguments
   */
  async route(argv) {
    // Load configuration first
    await configManager.load(argv);

    const { mode, args } = this.detectMode(argv);

    try {
      if (mode === 'interactive') {
        await this.launchInteractiveMode();
      } else {
        await this.launchClassicMode(args);
      }
    } catch (error) {
      console.error(chalk.red('CLI Router Error:'), error.message);

      // Fallback to interactive mode on any error
      console.log(chalk.cyan('💡 Falling back to interactive mode...'));
      await this.launchInteractiveMode();
    }
  }

  /**
   * Launch Interactive TUI Mode
   */
  async launchInteractiveMode() {
    try {
      const { default: InteractiveCLI } = await import('./interactiveCLI/index.js');

      // Import real coordinator and supporting services
      const { default: CommandCoordinator } = await import(
        '../application/command-coordinator.js'
      );
      const { default: ValidationEngine } = await import(
        '../application/validation-engine.js'
      );
      const { default: ProgressTracker } = await import(
        '../application/progress-tracker.js'
      );
      const { default: Logger } = await import(
        '../infrastructure/logging/winston-logger.js'
      );

      // Create logger with proper configuration
      const logLevel = configManager.get('logging.level', 'info');

      const logger = new Logger({
        level: logLevel,
        enableFile: configManager.get('logging.enableFile', true),
        cliMode: true,
        quiet: true // Always quiet in TUI mode to avoid retry message conflicts
      });

      // Initialize application services
      const progressTracker = new ProgressTracker(logger);
      const validator = new ValidationEngine({ logger });

      // Create real coordinator
      const coordinator = new CommandCoordinator({
        validator,
        progressTracker,
        logger
      });

      // Initialize the coordinator
      await coordinator.initialize();
      const interactiveCLI = new InteractiveCLI({
        coordinator,
        logger,
        config: configManager
      });

      await interactiveCLI.start();
    } catch (error) {
      console.log(
        chalk.yellow('⚠️ Interactive mode not available:', error.message)
      );
      throw error;
    }
  }

  /**
   * Launch Classic CLI Mode
   * @param {string[]} args - Command arguments
   */
  async launchClassicMode(args) {
    // Silent mode - no need to announce CLI mode

    try {
      // Re-enabled ClassicCLI with ES6 imports
      const { default: ClassicCLI } = await import('./classicCLI/index.js');
      const classicCLI = new ClassicCLI();
      await classicCLI.init();

      // Correctly format arguments for Commander.js
      // Include 'node' and script name as first two arguments
      const fullArgs = ['node', 'plat-cli', ...args];
      await classicCLI.run(fullArgs);
    } catch (error) {
      console.log(chalk.red('❌ Classic CLI error:', error.message));
      throw error; // Re-throw to trigger fallback in route()
    }
  }
}

export default CLIRouter;
