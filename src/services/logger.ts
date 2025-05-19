import * as Sentry from "@sentry/node";

// Log levels
type LogLevel = "debug" | "info" | "warning" | "error" | "fatal";

class Logger {
  private context: string;

  constructor(context: string = "app") {
    this.context = context;
  }

  /**
   * Log a debug message
   */
  debug(message: string, extra?: Record<string, any>): void {
    this._log("debug", message, extra);
  }

  /**
   * Log an info message
   */
  info(message: string, extra?: Record<string, any>): void {
    this._log("info", message, extra);
  }

  /**
   * Log a warning message
   */
  warn(message: string, extra?: Record<string, any>): void {
    this._log("warning", message, extra);
  }

  /**
   * Log an error message
   */
  error(message: string, extra?: Record<string, any>): void {
    this._log("error", message, extra);
  }

  /**
   * Log a fatal message
   */
  fatal(message: string, extra?: Record<string, any>): void {
    this._log("fatal", message, extra);
  }

  /**
   * Capture an exception
   */
  captureException(error: Error, extra?: Record<string, any>): void {
    console.error(`[${this.context}] ERROR:`, error);

    // Set additional context data
    const sentryExtra: Record<string, any> = { context: this.context };
    if (extra) {
      Object.assign(sentryExtra, extra);
    }

    // Capture the exception in Sentry
    Sentry.captureException(error, {
      tags: { context: this.context },
      extra: sentryExtra,
    });
  }

  /**
   * Internal method to log messages with the appropriate level
   */
  private _log(
    level: LogLevel,
    message: string,
    extra?: Record<string, any>
  ): void {
    // Log to console with appropriate level
    switch (level) {
      case "debug":
        console.debug(`[${this.context}] DEBUG:`, message, extra || "");
        break;
      case "info":
        console.info(`[${this.context}] INFO:`, message, extra || "");
        break;
      case "warning":
        console.warn(`[${this.context}] WARN:`, message, extra || "");
        break;
      case "error":
        console.error(`[${this.context}] ERROR:`, message, extra || "");
        break;
      case "fatal":
        console.error(`[${this.context}] FATAL:`, message, extra || "");
        break;
    }

    // Set additional context data
    const sentryExtra: Record<string, any> = { context: this.context };
    if (extra) {
      Object.assign(sentryExtra, extra);
    }

    // Send to Sentry
    Sentry.captureMessage(message, {
      level,
      tags: { context: this.context },
      extra: sentryExtra,
    });
  }
}

// Create a default logger instance
const defaultLogger = new Logger();

// Export the logger class and a default instance
export { Logger, defaultLogger };
export default defaultLogger;
