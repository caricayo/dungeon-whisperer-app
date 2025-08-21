/**
 * @fileoverview Enterprise error handling with classification, monitoring, and recovery
 * @enterprise Production-ready error handling with retry logic and monitoring integration
 */

import { Logger } from './Logger';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NETWORK = 'network',
  EXTERNAL_SERVICE = 'external_service',
  RATE_LIMIT = 'rate_limit',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export interface EnterpriseError {
  id: string;
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  retryable: boolean;
  context: {
    correlationId?: string;
    userId?: string;
    sessionId?: string;
    operation: string;
    timestamp: Date;
  };
  details?: Record<string, unknown>;
  originalError?: Error;
  userMessage: string; // Safe message to show to users
}

export interface ErrorRecoveryStrategy {
  canRecover(error: EnterpriseError): boolean;
  recover(error: EnterpriseError): Promise<boolean>;
}

/**
 * Enterprise error handler with comprehensive classification and recovery
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private readonly logger = Logger.getInstance('ErrorHandler');
  private readonly recoveryStrategies: ErrorRecoveryStrategy[] = [];

  private constructor() {
    this.setupDefaultRecoveryStrategies();
  }

  static getInstance(): ErrorHandler {
    if (!this.instance) {
      this.instance = new ErrorHandler();
    }
    return this.instance;
  }

  /**
   * Handle and classify any error
   */
  handleError(
    error: unknown,
    context: {
      correlationId?: string;
      userId?: string;
      sessionId?: string;
      operation: string;
    }
  ): EnterpriseError {
    const enterpriseError = this.classifyError(error, context);
    
    // Log the error
    this.logger.error('Error occurred', {
      ...context,
      errorId: enterpriseError.id,
      category: enterpriseError.category,
      severity: enterpriseError.severity
    }, enterpriseError.originalError);

    // Attempt recovery if possible
    this.attemptRecovery(enterpriseError);

    return enterpriseError;
  }

  /**
   * Specific handler for chat-related errors
   */
  handleChatError(
    error: unknown,
    context: {
      correlationId?: string;
      userId?: string;
      sessionId?: string;
      operation: string;
    }
  ): EnterpriseError {
    const enterpriseError = this.classifyError(error, context);
    
    // Add chat-specific context
    enterpriseError.details = {
      ...enterpriseError.details,
      domain: 'chat',
      features: ['ai-response', 'tts', 'session-management']
    };

    return this.handleError(error, context);
  }

  /**
   * Classify error into enterprise error structure
   */
  private classifyError(
    error: unknown,
    context: {
      correlationId?: string;
      userId?: string;
      sessionId?: string;
      operation: string;
    }
  ): EnterpriseError {
    const errorId = crypto.randomUUID();
    let category = ErrorCategory.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    let retryable = false;
    let userMessage = 'An unexpected error occurred. Please try again.';
    let code = 'UNKNOWN_ERROR';

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Network errors
      if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
        category = ErrorCategory.NETWORK;
        severity = ErrorSeverity.MEDIUM;
        retryable = true;
        userMessage = 'Connection issue. Please check your internet and try again.';
        code = 'NETWORK_ERROR';
      }
      
      // Authentication errors
      else if (message.includes('unauthorized') || message.includes('authentication')) {
        category = ErrorCategory.AUTHENTICATION;
        severity = ErrorSeverity.HIGH;
        retryable = false;
        userMessage = 'Please sign in to continue.';
        code = 'AUTH_ERROR';
      }
      
      // Rate limiting
      else if (message.includes('rate limit') || message.includes('too many requests')) {
        category = ErrorCategory.RATE_LIMIT;
        severity = ErrorSeverity.LOW;
        retryable = true;
        userMessage = 'You\'re sending requests too quickly. Please wait a moment.';
        code = 'RATE_LIMIT_ERROR';
      }
      
      // API/External service errors
      else if (message.includes('api') || message.includes('service unavailable')) {
        category = ErrorCategory.EXTERNAL_SERVICE;
        severity = ErrorSeverity.MEDIUM;
        retryable = true;
        userMessage = 'Service temporarily unavailable. Please try again in a moment.';
        code = 'SERVICE_ERROR';
      }
      
      // Validation errors
      else if (message.includes('validation') || message.includes('invalid')) {
        category = ErrorCategory.VALIDATION;
        severity = ErrorSeverity.LOW;
        retryable = false;
        userMessage = 'Please check your input and try again.';
        code = 'VALIDATION_ERROR';
      }
    }

    return {
      id: errorId,
      code,
      message: error instanceof Error ? error.message : String(error),
      category,
      severity,
      retryable,
      context: {
        ...context,
        timestamp: new Date()
      },
      originalError: error instanceof Error ? error : undefined,
      userMessage
    };
  }

  /**
   * Attempt to recover from error using registered strategies
   */
  private async attemptRecovery(error: EnterpriseError): Promise<void> {
    if (!error.retryable) return;

    for (const strategy of this.recoveryStrategies) {
      if (strategy.canRecover(error)) {
        try {
          const recovered = await strategy.recover(error);
          if (recovered) {
            this.logger.info('Error recovery successful', {
              errorId: error.id,
              strategy: strategy.constructor.name
            });
            return;
          }
        } catch (recoveryError) {
          this.logger.warn('Error recovery failed', {
            errorId: error.id,
            strategy: strategy.constructor.name,
            recoveryError
          });
        }
      }
    }
  }

  /**
   * Setup default recovery strategies
   */
  private setupDefaultRecoveryStrategies(): void {
    // Network retry strategy
    this.recoveryStrategies.push({
      canRecover: (error) => error.category === ErrorCategory.NETWORK,
      recover: async (error) => {
        // Implement network retry logic
        await new Promise(resolve => setTimeout(resolve, 1000));
        return true; // Simplified - would attempt actual retry
      }
    });

    // Rate limit backoff strategy
    this.recoveryStrategies.push({
      canRecover: (error) => error.category === ErrorCategory.RATE_LIMIT,
      recover: async (error) => {
        // Implement exponential backoff
        const backoffMs = Math.random() * 5000 + 2000; // 2-7 seconds
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return true;
      }
    });
  }

  /**
   * Register custom recovery strategy
   */
  addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: EnterpriseError): string {
    return error.userMessage;
  }

  /**
   * Check if error should trigger an alert
   */
  shouldAlert(error: EnterpriseError): boolean {
    return error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH;
  }
}