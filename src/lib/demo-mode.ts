import { env } from './env';
import { toast } from '@/hooks/use-toast';

/**
 * Unified demo mode guard for client-side operations
 * Prevents expensive operations when demo mode is enabled
 */
export const isDemoMode = env.VITE_DEMO_MODE;

/**
 * Client-side demo mode guard function
 * Shows user-friendly toast when feature is restricted in demo
 */
export function guardDemoMode(
  operation = 'This feature',
  showToast = true
): boolean {
  if (isDemoMode && showToast) {
    toast({
      title: `${operation} is disabled in Demo Mode`,
      description: 'Upgrade to unlock all AI-powered features',
      variant: 'default',
    });
  }
  return isDemoMode;
}

/**
 * Higher-order function to wrap async operations with demo mode protection
 */
export function withDemoGuard<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  operation?: string
) {
  return async (...args: T): Promise<R | null> => {
    if (guardDemoMode(operation)) {
      return null;
    }
    return fn(...args);
  };
}

/**
 * Decorator for component methods that should be disabled in demo mode
 */
export function demoModeGuard(
  target: unknown,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function (...args: unknown[]) {
    if (guardDemoMode(`${propertyKey}`)) {
      return;
    }
    return originalMethod.apply(this, args);
  };
  
  return descriptor;
}

/**
 * Demo mode configuration for different features
 */
export const demoModeConfig = {
  aiFeatures: {
    enabled: !isDemoMode,
    message: 'AI features are disabled in demo mode',
  },
  messaging: {
    enabled: true, // Always enabled for UX
    sendEnabled: !isDemoMode,
    message: 'Message sending is disabled in demo mode',
  },
  premiumFeatures: {
    enabled: !isDemoMode,
    message: 'Premium features require an upgrade',
  },
} as const;