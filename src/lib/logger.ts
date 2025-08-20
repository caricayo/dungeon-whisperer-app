import { env } from '@/lib/env';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  component?: string;
}

class Logger {
  private level: LogLevel = env.VITE_APP_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG;
  private buffer: LogEntry[] = [];
  private readonly maxBufferSize = 100;

  private formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userId: this.getUserId(),
      sessionId: this.getSessionId(),
      component: this.getComponent(),
    };
  }

  private getUserId(): string | undefined {
    try {
      return localStorage.getItem('user-id') || undefined;
    } catch {
      return undefined;
    }
  }

  private getSessionId(): string | undefined {
    try {
      return sessionStorage.getItem('current-session-id') || undefined;
    } catch {
      return undefined;
    }
  }

  private getComponent(): string | undefined {
    const stack = new Error().stack;
    if (!stack) return undefined;
    
    // Extract component name from stack trace
    const componentMatch = stack.match(/at (\w+)/g);
    return componentMatch?.[2]?.replace('at ', '') || undefined;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private writeToConsole(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] ${LogLevel[entry.level]}:`;
    const style = this.getConsoleStyle(entry.level);

    if (entry.context) {
      console.groupCollapsed(`%c${prefix} ${entry.message}`, style);
      console.table(entry.context);
      if (entry.userId) console.log('User ID:', entry.userId);
      if (entry.sessionId) console.log('Session ID:', entry.sessionId);
      if (entry.component) console.log('Component:', entry.component);
      console.groupEnd();
    } else {
      switch (entry.level) {
        case LogLevel.ERROR:
          console.error(`%c${prefix} ${entry.message}`, style);
          break;
        case LogLevel.WARN:
          console.warn(`%c${prefix} ${entry.message}`, style);
          break;
        default:
          console.log(`%c${prefix} ${entry.message}`, style);
      }
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return 'color: #ef4444; font-weight: bold;';
      case LogLevel.WARN:
        return 'color: #f59e0b; font-weight: bold;';
      case LogLevel.INFO:
        return 'color: #3b82f6;';
      case LogLevel.DEBUG:
        return 'color: #6b7280;';
      default:
        return '';
    }
  }

  private addToBuffer(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry = this.formatMessage(level, message, context);
    this.addToBuffer(entry);
    
    if (env.VITE_APP_ENV === 'development') {
      this.writeToConsole(entry);
    }

    // In production, you might want to send logs to a remote service
    if (env.VITE_APP_ENV === 'production' && level <= LogLevel.WARN) {
      this.sendToRemoteService(entry).catch(() => {
        // Silently fail to avoid recursive logging
      });
    }
  }

  private async sendToRemoteService(entry: LogEntry): Promise<void> {
    // Implementation would depend on your logging service
    // Example: send to Sentry, LogRocket, or custom endpoint
    if (env.VITE_SENTRY_DSN) {
      // Would integrate with Sentry here
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  clearBuffer(): void {
    this.buffer = [];
  }

  // Utility methods for common patterns
  performance(operation: string, duration: number): void {
    this.debug(`Performance: ${operation} took ${duration}ms`);
  }

  userAction(action: string, context?: Record<string, unknown>): void {
    this.info(`User Action: ${action}`, context);
  }

  apiCall(method: string, url: string, status?: number, duration?: number): void {
    const level = status && status >= 400 ? LogLevel.ERROR : LogLevel.DEBUG;
    this.log(level, `API ${method} ${url}`, {
      status,
      duration: duration ? `${duration}ms` : undefined,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for legacy compatibility with debug.ts
export const logInfo = (message: string, context?: Record<string, unknown>) => logger.info(message, context);
export const logError = (message: string, context?: Record<string, unknown>) => logger.error(message, context);
export const logWarn = (message: string, context?: Record<string, unknown>) => logger.warn(message, context);
export const logDebug = (message: string, context?: Record<string, unknown>) => logger.debug(message, context);