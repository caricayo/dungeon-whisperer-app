/**
 * Secure error handling utilities for production environments
 */

import { debugError, debugLog } from '@/lib/debug';

interface SecureErrorOptions {
  showToUser?: boolean;
  logLevel?: 'error' | 'warn' | 'info';
  context?: string;
}

/**
 * Handles errors securely without exposing sensitive information
 */
export function handleSecureError(
  error: Error | unknown, 
  userMessage = 'An unexpected error occurred',
  options: SecureErrorOptions = {}
): void {
  const { showToUser = false, logLevel = 'error', context } = options;
  
  // Log detailed error for debugging (only in development)
  if (logLevel === 'error') {
    debugError(context ? `[${context}]` : 'Error:', error);
  } else {
    debugLog(context ? `[${context}]` : 'Info:', error);
  }
  
  // In production, only show user-friendly messages
  if (showToUser && import.meta.env.MODE === 'production') {
    // Here you could integrate with your toast system
    console.warn(userMessage);
  } else if (showToUser) {
    // In development, show more details
    console.error(userMessage, error);
  }
}

/**
 * Validates that errors don't contain sensitive information before logging
 */
export function sanitizeErrorForLogging(error: unknown): string {
  if (error instanceof Error) {
    // Remove potential sensitive patterns from error messages
    return error.message
      .replace(/(?:api[_-]?key|password|token|secret)[=:]\s*[\w-]+/gi, '[REDACTED]')
      .replace(/sk-[a-zA-Z0-9]{40,}/g, '[API_KEY_REDACTED]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
  }
  
  return String(error);
}

/**
 * Rate-limited error reporter to prevent spam
 */
class RateLimitedErrorReporter {
  private readonly errorCounts = new Map<string, { count: number; lastReported: number }>();
  private readonly maxReportsPerMinute = 5;
  private readonly resetInterval = 60000; // 1 minute

  report(errorKey: string, error: unknown, context?: string): void {
    const now = Date.now();
    const errorInfo = this.errorCounts.get(errorKey) || { count: 0, lastReported: 0 };
    
    // Reset counter if enough time has passed
    if (now - errorInfo.lastReported > this.resetInterval) {
      errorInfo.count = 0;
    }
    
    errorInfo.count++;
    errorInfo.lastReported = now;
    this.errorCounts.set(errorKey, errorInfo);
    
    // Only report if under rate limit
    if (errorInfo.count <= this.maxReportsPerMinute) {
      handleSecureError(error, `Error in ${context || errorKey}`, {
        context,
        logLevel: 'error'
      });
    } else if (errorInfo.count === this.maxReportsPerMinute + 1) {
      debugLog(`Rate limiting errors for: ${errorKey}`);
    }
  }
}

export const errorReporter = new RateLimitedErrorReporter();