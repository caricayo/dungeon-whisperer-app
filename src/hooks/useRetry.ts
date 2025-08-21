import { useState, useCallback } from 'react';
import { debugLog, debugError } from '@/lib/debug';

interface RetryOptions {
  maxAttempts: number;
  delay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000
};

export const useRetry = <T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);

  const config = { ...DEFAULT_OPTIONS, ...options };

  const execute = useCallback(async (): Promise<T> => {
    setIsRetrying(true);
    setAttempt(0);
    setLastError(null);

    for (let currentAttempt = 1; currentAttempt <= config.maxAttempts; currentAttempt++) {
      setAttempt(currentAttempt);

      try {
        debugLog(`Attempt ${currentAttempt}/${config.maxAttempts}`);
        const result = await fn();
        setIsRetrying(false);
        return result;
      } catch {
        const err = error as Error;
        setLastError(err);
        
        debugError(`Attempt ${currentAttempt} failed:`, err);

        if (currentAttempt === config.maxAttempts) {
          setIsRetrying(false);
          throw new Error(`Failed after ${config.maxAttempts} attempts: ${err.message}`);
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.delay * Math.pow(config.backoffMultiplier, currentAttempt - 1),
          config.maxDelay
        );

        debugLog(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    setIsRetrying(false);
    throw lastError ?? new Error('Retry failed');
  }, [fn, config]);

  const reset = useCallback(() => {
    setIsRetrying(false);
    setAttempt(0);
    setLastError(null);
  }, []);

  return {
    execute,
    reset,
    isRetrying,
    attempt,
    lastError
  };
};