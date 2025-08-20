import { isDemoMode, guardDemoMode } from '@/lib/demo-mode';
import { debugLog, debugError } from '@/lib/debug';
import { toast } from '@/hooks/use-toast';

/**
 * Enhanced demo mode guard for API calls
 * Context-7 Doc Assist compliance: Prevents ALL paid API calls in demo mode
 */
export class DemoModeAPIGuard {
  private static readonly blockedAPIs = [
    'dnd-chat-v2',
    'dnd-chat', 
    'dnd-image',
    'dnd-video',
    'dnd-tts',
    'elevenlabs-tts',
    'luma-video',
    'session-messages'
  ];

  /**
   * Check if API call should be blocked in demo mode
   */
  static shouldBlockAPI(functionName: string): boolean {
    return isDemoMode && this.blockedAPIs.includes(functionName);
  }

  /**
   * Guard function for Supabase edge function calls
   */
  static async guardSupabaseFunction<T>(
    functionName: string,
    invokeFunction: () => Promise<T>,
    options?: {
      showToast?: boolean;
      fallbackData?: T;
      operationName?: string;
    }
  ): Promise<T> {
    const showToast = options?.showToast ?? true;
    const operationName = options?.operationName ?? functionName;

    if (this.shouldBlockAPI(functionName)) {
      debugLog(`[DemoGuard] Blocking API call to ${functionName} in demo mode`);
      
      if (showToast) {
        toast({
          title: `${operationName} is disabled in Demo Mode`,
          description: 'Upgrade to unlock all AI-powered features',
          variant: 'default',
        });
      }

      if (options?.fallbackData !== undefined) {
        return options.fallbackData;
      }

      throw new Error(`${operationName} is not available in demo mode`);
    }

    try {
      debugLog(`[DemoGuard] Allowing API call to ${functionName}`);
      return await invokeFunction();
    } catch (error) {
      debugError(`[DemoGuard] API call to ${functionName} failed:`, error);
      throw error;
    }
  }

  /**
   * Guard for general paid API operations
   */
  static guardPaidOperation(
    operationName: string,
    operation: () => void,
    showToast = true
  ): boolean {
    if (isDemoMode) {
      debugLog(`[DemoGuard] Blocking paid operation: ${operationName}`);
      
      if (showToast) {
        toast({
          title: `${operationName} is disabled in Demo Mode`,
          description: 'Upgrade to unlock this feature',
          variant: 'default',
        });
      }
      
      return false;
    }

    try {
      operation();
      return true;
    } catch (error) {
      debugError(`[DemoGuard] Operation ${operationName} failed:`, error);
      throw error;
    }
  }

  /**
   * Create a demo-guarded version of a function
   */
  static createGuardedFunction<T extends unknown[], R>(
    operationName: string,
    fn: (...args: T) => R,
    options?: {
      showToast?: boolean;
      fallbackValue?: R;
    }
  ): (...args: T) => R {
    return (...args: T): R => {
      if (isDemoMode) {
        debugLog(`[DemoGuard] Blocking function: ${operationName}`);
        
        if (options?.showToast ?? true) {
          toast({
            title: `${operationName} is disabled in Demo Mode`,
            description: 'Upgrade to unlock this feature',
            variant: 'default',
          });
        }

        if (options?.fallbackValue !== undefined) {
          return options.fallbackValue;
        }

        throw new Error(`${operationName} is not available in demo mode`);
      }

      return fn(...args);
    };
  }

  /**
   * Log blocked API attempt for analytics
   */
  static logBlockedAttempt(functionName: string, userId?: string): void {
    debugLog(`[DemoGuard] Blocked API attempt:`, {
      function: functionName,
      userId: userId || 'anonymous',
      timestamp: new Date().toISOString(),
      isDemoMode
    });

    // In production, this could send analytics to understand
    // which features users try to use in demo mode
  }
}

/**
 * Decorator for automatic demo mode protection
 */
export function demoPaidAPIGuard(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const name = operationName || propertyKey;
    
    descriptor.value = function (...args: any[]) {
      if (isDemoMode) {
        DemoModeAPIGuard.logBlockedAttempt(name);
        guardDemoMode(name);
        return null;
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

export default DemoModeAPIGuard;