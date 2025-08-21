/**
 * @fileoverview Global error handler for unhandled promises and runtime errors
 * Provides comprehensive error tracking and user-friendly error reporting
 */

import { SecurityLogger } from './security';

interface ErrorReport {
  message: string;
  stack?: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
  userAgent: string;
  timestamp: string;
  type: 'javascript' | 'promise' | 'resource' | 'custom';
  userId?: string;
}

class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private errorQueue: ErrorReport[] = [];
  private readonly maxQueueSize = 50;
  private isInitialized = false;

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Initialize global error handlers
   */
  initialize(): void {
    if (this.isInitialized) return;

    this.setupJavaScriptErrorHandler();
    this.setupUnhandledPromiseHandler();
    this.setupResourceErrorHandler();
    this.setupConsoleErrorOverride();

    this.isInitialized = true;
    console.warn('🛡️ Global error handler initialized');
  }

  /**
   * Setup handler for JavaScript runtime errors
   */
  private setupJavaScriptErrorHandler(): void {
    window.addEventListener('error', (event) => {
      const errorReport: ErrorReport = {
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        type: 'javascript'
      };

      this.handleError(errorReport);
    });
  }

  /**
   * Setup handler for unhandled promise rejections
   */
  private setupUnhandledPromiseHandler(): void {
    window.addEventListener('unhandledrejection', (event) => {
      const errorReport: ErrorReport = {
        message: event.reason?.message ?? 'Unhandled Promise Rejection',
        stack: event.reason?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        type: 'promise'
      };

      this.handleError(errorReport);
      
      // Prevent the default console.error
      event.preventDefault();
    });
  }

  /**
   * Setup handler for resource loading errors
   */
  private setupResourceErrorHandler(): void {
    window.addEventListener('error', (event) => {
      // Check if it's a resource loading error
      const target = event.target;
      if (target && target !== window) {
        const errorReport: ErrorReport = {
          message: `Resource failed to load: ${target.outerHTML?.slice(0, 100) ?? 'Unknown resource'}`,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          type: 'resource'
        };

        this.handleError(errorReport);
      }
    }, true); // Use capture phase for resource errors
  }

  /**
   * Override console.error to catch logged errors
   */
  private setupConsoleErrorOverride(): void {
    const originalConsoleError = console.error;
    
    console.error = (...args: unknown[]) => {
      // Only capture actual Error objects, not debug logs
      const errorArg = args.find(arg => arg instanceof Error);
      
      if (errorArg) {
        const errorReport: ErrorReport = {
          message: errorArg.message,
          stack: errorArg.stack,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          type: 'custom'
        };

        this.handleError(errorReport);
      }

      // Call original console.error
      originalConsoleError.apply(console, args);
    };
  }

  /**
   * Handle and process error reports
   */
  private handleError(errorReport: ErrorReport): void {
    // Add to error queue
    this.errorQueue.unshift(errorReport);
    
    // Maintain queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue = this.errorQueue.slice(0, this.maxQueueSize);
    }

    // Log security event
    SecurityLogger.logSecurityEvent('global_error', {
      type: errorReport.type,
      message: errorReport.message,
      url: errorReport.url
    });

    // In development, log to console
    if (import.meta.env.DEV) {
      console.warn(`🚨 ${errorReport.type.toUpperCase()} ERROR`);
      console.error('Message:', errorReport.message);
      console.error('URL:', errorReport.url);
      if (errorReport.stack) {
        console.error('Stack:', errorReport.stack);
      }
    }

    // In production, send to monitoring service (e.g., Sentry, LogRocket)
    if (import.meta.env.PROD) {
      this.reportToMonitoring(errorReport);
    }

    // Show user-friendly notification for critical errors
    if (this.isCriticalError(errorReport)) {
      this.showUserNotification(errorReport);
    }
  }

  /**
   * Report error to external monitoring service
   */
  private reportToMonitoring(errorReport: ErrorReport): void {
    // Integration with monitoring services
    try {
      // Example: Send to Sentry, LogRocket, or custom endpoint
      if (window.gtag) {
        window.gtag('event', 'exception', {
          description: errorReport.message,
          fatal: this.isCriticalError(errorReport)
        });
      }

      // Could also send to a custom error reporting endpoint
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(errorReport)
      }).catch(() => {
        // Silently fail - don't create error loops
      });
      
    } catch (reportingError) {
      // Don't let error reporting cause more errors
      console.warn('Failed to report error to monitoring service:', reportingError);
    }
  }

  /**
   * Determine if error is critical and needs user attention
   */
  private isCriticalError(errorReport: ErrorReport): boolean {
    const criticalPatterns = [
      /network.*error/i,
      /failed.*to.*fetch/i,
      /auth.*error/i,
      /permission.*denied/i,
      /out.*of.*memory/i,
      /quota.*exceeded/i
    ];

    return criticalPatterns.some(pattern => 
      pattern.test(errorReport.message) || 
      pattern.test(errorReport.stack ?? '')
    );
  }

  /**
   * Show user-friendly error notification
   */
  private showUserNotification(errorReport: ErrorReport): void {
    // Create a non-intrusive notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Application Error', {
        body: 'We encountered an issue. Please try refreshing the page.',
        icon: '/favicon.ico',
        tag: 'app-error'
      });
    }

    // Or use a toast notification if available
    if (window.showToast) {
      window.showToast({
        title: 'Something went wrong',
        description: 'We\'ve logged the issue and are working on it.',
        variant: 'destructive'
      });
    }
  }

  /**
   * Get recent error reports for debugging
   */
  getRecentErrors(limit = 10): ErrorReport[] {
    return this.errorQueue.slice(0, limit);
  }

  /**
   * Clear error queue
   */
  clearErrors(): void {
    this.errorQueue = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): { total: number; byType: Record<string, number>; recent: number } {
    const byType: Record<string, number> = {};
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let recentCount = 0;

    this.errorQueue.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      
      if (new Date(error.timestamp).getTime() > oneHourAgo) {
        recentCount++;
      }
    });

    return {
      total: this.errorQueue.length,
      byType,
      recent: recentCount
    };
  }

  /**
   * Manually report a custom error
   */
  reportError(error: Error, context?: Record<string, unknown>): void {
    const errorReport: ErrorReport = {
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      type: 'custom',
      ...context
    };

    this.handleError(errorReport);
  }
}

// Export singleton instance
export const globalErrorHandler = GlobalErrorHandler.getInstance();

// Initialize when module loads (in browser)
if (typeof window !== 'undefined') {
  globalErrorHandler.initialize();
}

// Export for manual error reporting
export { type ErrorReport };

// Extend window object for TypeScript
declare global {
  interface Window {
    showToast?: (options: {
      title: string;
      description: string;
      variant?: 'default' | 'destructive';
    }) => void;
    gtag?: (...args: unknown[]) => void;
  }
}