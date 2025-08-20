/**
 * @fileoverview Enterprise logging system with structured logging and multiple transports
 * @enterprise Production-ready logging with correlation IDs, log levels, and monitoring integration
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LogTransport {
  log(entry: LogEntry): Promise<void>;
}

/**
 * Console transport for development
 */
class ConsoleTransport implements LogTransport {
  async log(entry: LogEntry): Promise<void> {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.CRITICAL]: '\x1b[35m' // Magenta
    };

    const reset = '\x1b[0m';
    const levelName = LogLevel[entry.level];
    const color = colors[entry.level];

    console.log(
      `${color}[${entry.timestamp}] ${levelName}${reset} ${entry.context}: ${entry.message}`,
      entry.metadata ? entry.metadata : ''
    );

    if (entry.error) {
      console.error(`${color}Error:${reset}`, entry.error);
    }
  }
}

/**
 * Remote transport for production monitoring (e.g., DataDog, New Relic)
 */
class RemoteTransport implements LogTransport {
  constructor(private readonly endpoint: string, private readonly apiKey: string) {}

  async log(entry: LogEntry): Promise<void> {
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      // Fallback to console if remote logging fails
      console.error('Remote logging failed:', error);
      await new ConsoleTransport().log(entry);
    }
  }
}

/**
 * Enterprise logger with multiple transports and structured logging
 */
export class Logger {
  private static readonly instances = new Map<string, Logger>();
  private readonly transports: LogTransport[] = [];
  private minLevel: LogLevel = LogLevel.INFO;

  private constructor(private readonly context: string) {
    // Add default console transport
    this.transports.push(new ConsoleTransport());

    // SECURITY: Remote logging moved to server-side edge function
    // Client-side API keys are a security vulnerability
    // Production logs should be sent via secure edge function

    // Set log level based on environment
    this.minLevel = import.meta.env.MODE === 'production' 
      ? LogLevel.INFO 
      : LogLevel.DEBUG;
  }

  /**
   * Get logger instance for specific context (singleton per context)
   */
  static getInstance(context: string): Logger {
    if (!this.instances.has(context)) {
      this.instances.set(context, new Logger(context));
    }
    return this.instances.get(context);
  }

  /**
   * Add custom transport
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Log entry with specified level
   */
  private async log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): Promise<void> {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      metadata,
      correlationId: metadata?.correlationId as string,
      userId: metadata?.userId as string,
      sessionId: metadata?.sessionId as string,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    // Log to all transports
    await Promise.all(
      this.transports.map(transport => 
        transport.log(entry).catch(err => 
          console.error('Transport failed:', err)
        )
      )
    );
  }

  /**
   * Debug level logging
   */
  async debug(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log(LogLevel.DEBUG, message, metadata);
  }

  /**
   * Info level logging
   */
  async info(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log(LogLevel.INFO, message, metadata);
  }

  /**
   * Warning level logging
   */
  async warn(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log(LogLevel.WARN, message, metadata);
  }

  /**
   * Error level logging
   */
  async error(message: string, metadata?: Record<string, unknown>, error?: Error): Promise<void> {
    await this.log(LogLevel.ERROR, message, metadata, error);
  }

  /**
   * Critical level logging
   */
  async critical(message: string, metadata?: Record<string, unknown>, error?: Error): Promise<void> {
    await this.log(LogLevel.CRITICAL, message, metadata, error);
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: string): Logger {
    return Logger.getInstance(`${this.context}:${additionalContext}`);
  }
}