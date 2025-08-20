// Debug utility for console logging with enhanced error tracking
const DEBUG = import.meta.env.MODE !== 'production'; // Only debug in development

// Global error collector for mystery analysis
(window as any).__debug_errors = (window as any).__debug_errors || [];

export const debugLog = (...args: any[]) => {
  if (DEBUG) {
    console.log(...args);
    
    // Store significant debug events
    if (args.some(arg => typeof arg === 'string' && 
        (arg.includes('TTS') || arg.includes('AUDIO') || arg.includes('BLOB')))) {
      (window as any).__debug_errors.push({
        type: 'log',
        timestamp: new Date().toISOString(),
        args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
      });
      
      // Keep only last 50 debug entries
      if ((window as any).__debug_errors.length > 50) {
        (window as any).__debug_errors = (window as any).__debug_errors.slice(-50);
      }
    }
  }
};

export const debugError = (...args: any[]) => {
  if (DEBUG) {
    console.error(...args);
    
    // Always store errors for mystery analysis
    (window as any).__debug_errors.push({
      type: 'error',
      timestamp: new Date().toISOString(),
      args: args.map(arg => {
        if (arg instanceof Error) {
          return {
            name: arg.name,
            message: arg.message,
            stack: arg.stack
          };
        }
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      })
    });
    
    // Keep only last 50 debug entries
    if ((window as any).__debug_errors.length > 50) {
      (window as any).__debug_errors = (window as any).__debug_errors.slice(-50);
    }
  }
};

export const debugWarn = (...args: any[]) => {
  if (DEBUG) {
    console.warn(...args);
    
    // Store warnings for mystery analysis
    (window as any).__debug_errors.push({
      type: 'warn',
      timestamp: new Date().toISOString(),
      args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
    });
    
    // Keep only last 50 debug entries
    if ((window as any).__debug_errors.length > 50) {
      (window as any).__debug_errors = (window as any).__debug_errors.slice(-50);
    }
  }
};

// Helper function to get all debug info
export const getDebugSummary = () => {
  return {
    errors: (window as any).__debug_errors || [],
    ttsError: (window as any).__tts_mystery_error || null,
    audioError: (window as any).__audio_mystery_error || null,
    browserInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      language: navigator.language,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints
    },
    timestamp: new Date().toISOString()
  };
};