// Production error handler and performance optimizer
export interface SessionManagerConfig {
  maxRetries: number;
  retryDelay: number;
  syncDebounce: number;
  maxLocalSessions: number;
}

export const DEFAULT_CONFIG: SessionManagerConfig = {
  maxRetries: 3,
  retryDelay: 1000, 
  syncDebounce: 5000,
  maxLocalSessions: 10
};

// Enhanced error types for better error handling
export class SessionError extends Error {
  constructor(
    message: string,
    public code: 'NETWORK' | 'AUTH' | 'VALIDATION' | 'STORAGE' | 'UNKNOWN',
    public retryable = true
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

// Session data validator
export const validateSession = (session: unknown): boolean => {
  if (!session || typeof session !== 'object') return false;
  
  const requiredFields = ['id', 'name', 'messages', 'createdAt'];
  for (const field of requiredFields) {
    if (!(field in session)) return false;
  }
  
  if (!Array.isArray(session.messages)) return false;
  if (typeof session.name !== 'string' || session.name.length === 0) return false;
  if (!session.id || typeof session.id !== 'string') return false;
  
  return true;
};

// Retry utility with exponential backoff
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULT_CONFIG.maxRetries,
  delay: number = DEFAULT_CONFIG.retryDelay
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch {
      lastError = new Error("Operation failed");
      
      if (attempt === maxRetries) {
        throw new SessionError(
          `Failed after ${maxRetries + 1} attempts: ${lastError.message}`,
          'NETWORK'
        );
      }
      
      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
};