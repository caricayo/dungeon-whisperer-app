import { useEffect, useCallback } from 'react';
import { SecurityLogger } from '@/lib/security';
import { securityHandlers } from '@/middleware/security';
import { env } from '@/lib/env';

/**
 * Security monitoring hook for detecting potential threats
 */
export function useSecurityMonitor() {
  const monitorClipboard = useCallback(() => {
    if (env.VITE_APP_ENV !== 'production') return;
    
    const handlePaste = (event: ClipboardEvent) => {
      const pasteData = event.clipboardData?.getData('text') || '';
      
      // Check for potential script injection
      if (/<script|javascript:|on\w+\s*=|<iframe/i.test(pasteData)) {
        securityHandlers.handleXSSAttempt(pasteData);
        event.preventDefault();
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const monitorConsole = useCallback(() => {
    if (env.VITE_APP_ENV !== 'production') return;

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Monitor for suspicious console activity
    console.log = (...args) => {
      if (args.some(arg => 
        typeof arg === 'string' && 
        /password|token|secret|key/i.test(arg)
      )) {
        SecurityLogger.logSecurityEvent('sensitive_data_logged', { 
          type: 'console.log' 
        });
      }
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      if (args.some(arg => 
        typeof arg === 'string' && 
        /unauthorized|403|401|csrf/i.test(arg)
      )) {
        SecurityLogger.logSecurityEvent('security_error_logged', { 
          type: 'console.error' 
        });
      }
      originalError.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  const monitorStorageAccess = useCallback(() => {
    const originalSetItem = localStorage.setItem;
    const originalGetItem = localStorage.getItem;

    localStorage.setItem = function(key: string, value: string) {
      if (/password|secret|private.*key|token/i.test(key) || 
          /password|secret|private.*key|token/i.test(value)) {
        SecurityLogger.logSecurityEvent('sensitive_storage_attempt', { 
          key: key.substring(0, 20) + '...' 
        });
      }
      return originalSetItem.call(this, key, value);
    };

    localStorage.getItem = function(key: string) {
      if (/password|secret|private.*key|token/i.test(key)) {
        SecurityLogger.logSecurityEvent('sensitive_storage_access', { 
          key: key.substring(0, 20) + '...' 
        });
      }
      return originalGetItem.call(this, key);
    };

    return () => {
      localStorage.setItem = originalSetItem;
      localStorage.getItem = originalGetItem;
    };
  }, []);

  const detectDevTools = useCallback(() => {
    if (env.VITE_APP_ENV !== 'production') return;

    const devtools = { open: false, orientation: '' };
    
    setInterval(() => {
      const threshold = 160;
      
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          SecurityLogger.logSecurityEvent('devtools_opened', {
            timestamp: new Date().toISOString()
          });
        }
      } else {
        devtools.open = false;
      }
    }, 1000);
  }, []);

  useEffect(() => {
    const cleanupFunctions: ((() => void) | void)[] = [
      monitorClipboard(),
      monitorConsole(),
      monitorStorageAccess(),
      detectDevTools(),
    ];

    return () => {
      cleanupFunctions.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
    };
  }, [monitorClipboard, monitorConsole, monitorStorageAccess, detectDevTools]);

  return {
    reportSecurityEvent: SecurityLogger.logSecurityEvent,
    handlers: securityHandlers,
  };
}