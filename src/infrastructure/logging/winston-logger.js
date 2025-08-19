import winston from 'winston';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';

/**
 * Modern Logger with Clean CLI Output
 *
 * Provides two modes:
 * 1. CLI Mode: Minimal, clean output for user-facing operations
 * 2. Debug Mode: Detailed logging to files for troubleshooting
 */
class ModernLogger {
  constructor(options = {}) {
    this.level = options.level || process.env.LOG_LEVEL || 'info';
    this.cliMode = options.cliMode !== false; // Default to CLI mode
    this.enableFile =
      options.enableFile !== false &&
      process.env.ENABLE_FILE_LOGGING !== 'false';
    this.logDir =
      options.logDir || process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    this.quiet = options.quiet || false;

    this.logger = this._createLogger();
    this.progressTracker = options.progressTracker || null;
  }

  _createLogger() {
    const transports = [];

    // Console transport only if not in quiet mode
    if (!this.quiet) {
      transports.push(
        new winston.transports.Console({
          level: this.cliMode ? 'warn' : this.level,
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ level, message, ...meta }) => {
              if (this.cliMode) {
                // In CLI mode, only show warnings and errors to console
                return message;
              } else {
                // Debug mode shows full logging
                let log = `${new Date().toLocaleTimeString('pt-BR')} [${level}]: ${message}`;
                if (Object.keys(meta).length > 0) {
                  log += ` ${JSON.stringify(meta)}`;
                }
                return log;
              }
            })
          )
        })
      );
    }

    // Always add file transport if enabled for detailed debugging
    if (this.enableFile) {
      try {
        // fs is already imported at the top
        if (!fs.existsSync(this.logDir)) {
          fs.mkdirSync(this.logDir, { recursive: true });
        }

        transports.push(
          new winston.transports.File({
            filename: path.join(this.logDir, 'plat-cli.log'),
            level: 'debug',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            ),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
          }),
          new winston.transports.File({
            filename: path.join(this.logDir, 'error.log'),
            level: 'error',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.json()
            ),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
          })
        );
      } catch (error) {
        console.warn(
          chalk.yellow('⚠️  Failed to setup file logging:'),
          error.message
        );
      }
    }

    return winston.createLogger({
      level: 'debug', // Always capture everything in files
      transports
    });
  }

  // Core logging methods - minimal console output in CLI mode
  debug(message, meta = {}) {
    // Only file logging for debug messages in CLI mode
    this.logger.debug(message, meta);
  }

  info(message, meta = {}) {
    // File logging always happens
    this.logger.info(message, meta);

    // In CLI mode, delegate display to progress tracker or skip console
    if (this.cliMode && this.progressTracker) {
      // Let progress tracker handle display
      return;
    } else if (!this.cliMode) {
      // Debug mode shows info on console
      console.log(message);
    }
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
    if (!this.quiet) {
      console.log(chalk.yellow('⚠️ '), message);
    }
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
    if (!this.quiet) {
      console.log(chalk.red('❌'), message);
    }
  }

  // Modern CLI-specific methods
  header(title) {
    if (!this.quiet && !this.cliMode) {
      console.log(chalk.cyan.bold(title));
    }
    this.logger.info(`HEADER: ${title}`);
  }

  success(message, meta = {}) {
    this.logger.info(`SUCCESS: ${message}`, meta);
    if (!this.quiet) {
      console.log(chalk.green('✅'), message);
    }
  }

  status(message, meta = {}) {
    this.logger.info(`STATUS: ${message}`, meta);
    if (this.progressTracker) {
      this.progressTracker.status(message, 'info');
    } else if (!this.quiet && !this.cliMode) {
      console.log(chalk.blue('🔍'), message);
    }
  }

  processing(message, meta = {}) {
    this.logger.info(`PROCESSING: ${message}`, meta);
    if (this.progressTracker) {
      this.progressTracker.status(message, 'processing');
    } else if (!this.quiet && !this.cliMode) {
      console.log(chalk.cyan('⏳'), message);
    }
  }

  // Migration specific methods - streamlined for CLI
  logMigrationStart(config) {
    const summary = {
      source: `${config.source.project}:${config.source.instance}`,
      target: `${config.target.project}:${config.target.instance}`,
      databases: config.source.databases || 'ALL'
    };

    this.logger.info('Migration started', summary);

    if (!this.quiet && this.cliMode && this.progressTracker) {
      this.progressTracker.status('Migration initialized', 'success');
    }
  }

  logMigrationComplete(duration, stats) {
    const summary = { duration, ...stats };
    this.logger.info('Migration completed successfully', summary);
  }

  // Connection methods - minimal output
  logConnectionAttempt(target, attempt, maxAttempts) {
    this.logger.debug(
      `Connection attempt: ${target} (${attempt}/${maxAttempts})`
    );
    // No console output in CLI mode - too verbose
  }

  logConnectionSuccess(target, version) {
    this.logger.info(`Connected: ${target}`, { version });
    // Minimal console feedback
    if (!this.quiet && this.cliMode && this.progressTracker) {
      this.progressTracker.status(`Connected to ${target}`, 'success');
    }
  }

  logConnectionError(target, error, attempt, maxAttempts) {
    // Determine the specific error type
    let errorType = 'Unknown error';
    let errorHint = '';
    
    if (error.code === 'ECONNREFUSED') {
      errorType = 'Connection refused';
      errorHint = '(check IP/port)';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      errorType = 'Connection timeout';
      errorHint = '(network issue or firewall)';
    } else if (error.message?.includes('password') || error.message?.includes('authentication')) {
      errorType = 'Authentication failed';
      errorHint = '(check password)';
    } else if (error.message?.includes('SSL') || error.message?.includes('certificate')) {
      errorType = 'SSL/TLS error';
      errorHint = '(check SSL configuration)';
    } else if (error.code === 'ENOTFOUND') {
      errorType = 'Host not found';
      errorHint = '(check hostname/IP)';
    } else if (error.message?.includes('database') && error.message?.includes('does not exist')) {
      errorType = 'Database not found';
      errorHint = '';
    }
    
    this.logger.error(`Connection failed: ${target}`, {
      error: error.message,
      errorCode: error.code,
      errorType,
      attempt,
      maxAttempts,
      willRetry: attempt < maxAttempts
    });

    if (!this.quiet) {
      if (attempt === maxAttempts) {
        // Final failure - show error type
        console.log(chalk.red('❌'), `Connection failed: ${errorType} ${errorHint}`.trim());
      } else if (attempt === 1) {
        // First failure - show brief message
        console.log(chalk.yellow('⚠'), `Connection issue: ${errorType}, retrying...`);
      }
      // Don't show anything for intermediate retries to reduce verbosity
    }
  }

  // Database operations - minimal console output
  logDatabaseOperation(operation, database, details = {}) {
    this.logger.info(`${operation}: ${database}`, details);

    // Only log significant operations to console in CLI mode
    const significantOps = [
      'EXPORT INICIADO',
      'EXPORT CONCLUÍDO',
      'IMPORT INICIADO',
      'IMPORT CONCLUÍDO'
    ];
    if (!this.quiet && this.cliMode && significantOps.includes(operation)) {
      const shortMessage = operation.includes('INICIADO')
        ? `Starting ${operation.split(' ')[0].toLowerCase()} of ${database}`
        : `Completed ${operation.split(' ')[0].toLowerCase()} of ${database}`;

      if (this.progressTracker) {
        this.progressTracker.status(shortMessage, 'processing');
      }
    }
  }

  // Simplified progress logging
  logProgress(operation, current, total, eta = null) {
    const percentage = Math.round((current / total) * 100);
    const message = `${operation}: ${current}/${total} (${percentage}%)`;

    this.logger.debug(message, { operation, current, total, percentage, eta });
    // No console output - handled by progress tracker
  }

  logRetry(operation, attempt, maxAttempts, delay) {
    this.logger.warn(`Retry ${operation}`, {
      attempt,
      maxAttempts,
      delayMs: delay,
      nextRetryIn: `${Math.round(delay / 1000)}s`
    });

    // Don't show retries on console - already handled in logConnectionError
    // This reduces verbosity significantly
  }

  // Create child logger with additional context
  child() {
    return new ModernLogger({
      level: this.level,
      cliMode: this.cliMode,
      enableFile: this.enableFile,
      logDir: this.logDir,
      quiet: this.quiet,
      progressTracker: this.progressTracker
    });
  }

  // Set progress tracker for integration
  setProgressTracker(tracker) {
    this.progressTracker = tracker;
  }

  // Enable/disable CLI mode
  setCLIMode(enabled) {
    this.cliMode = enabled;
  }

  // Enable/disable quiet mode
  setQuiet(enabled) {
    this.quiet = enabled;
  }
}

export default ModernLogger;
