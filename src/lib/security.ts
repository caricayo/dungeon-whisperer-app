import { env } from './env';

/**
 * Content Security Policy configuration
 */
export const CSP_DIRECTIVES = {
  development: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': ["'self'", 'data:', 'https:', 'blob:'],
    'connect-src': ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  },
  production: {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'img-src': ["'self'", 'data:', 'https:', 'blob:'],
    'connect-src': ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'upgrade-insecure-requests': true,
  }
} as const;

/**
 * Security headers for enhanced protection
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
} as const;

/**
 * Rate limiting configurations
 */
export const RATE_LIMITS = {
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  messages: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
  },
} as const;

/**
 * Input sanitization utilities
 */
const DANGEROUS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi, // More efficient script tag pattern
  /javascript:/gi,
  /on(?:load|error|click|mouseover|submit)\s*=/gi, // Specific event handlers
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<form[^>]*>/gi,
];

/**
 * Sanitize HTML content by removing dangerous patterns
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  
  let sanitized = input;
  
  DANGEROUS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized.trim();
}

/**
 * Sanitize text input for safe display
 */
export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/&/g, '&amp;')
    .trim();
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string') return null;
  
  try {
    const parsedUrl = new URL(url);
    
    // Only allow safe protocols
    if (!['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol)) {
      return null;
    }
    
    return parsedUrl.toString();
  } catch {
    return null;
  }
}

/**
 * Validate and sanitize file name
 */
export function sanitizeFileName(fileName: string): string {
  if (typeof fileName !== 'string') return 'unnamed-file';
  
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase()
    .slice(0, 100); // Limit length
}

export const InputSanitizer = {
  sanitizeHtml,
  sanitizeText,
  sanitizeUrl,
  sanitizeFileName
};

/**
 * Security logger for audit trails  
 */
const PII_PATTERNS = [
  /\b[\w._%+-]+@[\w.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
  /\b\d{3}-?\d{2}-?\d{4}\b/g, // SSN
  /password/gi,
  /secret/gi,
  /token/gi,
];

/**
 * Sanitize log data by redacting PII
 */
function sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, _value] of Object.entries(data)) {
    if (typeof value === 'string') {
      let sanitizedValue = value;
      
      PII_PATTERNS.forEach(pattern => {
        sanitizedValue = sanitizedValue.replace(pattern, '[REDACTED]');
      });
      
      Object.defineProperty(sanitized, key, {
        value: sanitizedValue,
        enumerable: true,
        writable: true,
        configurable: true
      });
    } else {
      Object.defineProperty(sanitized, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true
      });
    }
  }
  
  return sanitized;
}

/**
 * Log security event with PII redaction
 */
export function logSecurityEvent(event: string, details: Record<string, unknown>): void {
  const sanitizedDetails = sanitizeLogData(details);
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details: sanitizedDetails,
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  if (env.VITE_APP_ENV === 'development') {
    console.warn('🔒 Security Event:', logEntry);
  } else {
    // In production, send to monitoring service
    console.warn(`Security Event: ${event}`, { timestamp: logEntry.timestamp });
  }
}

export const SecurityLogger = {
  logSecurityEvent
};

/**
 * Secure storage utilities
 */
const STORAGE_PREFIX = 'dnd_secure_';

/**
 * Generate simple checksum for data integrity
 */
function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Securely store data in localStorage with basic obfuscation
 */
export function setSecureItem(key: string, value: unknown): void {
  try {
    const data = {
      value,
      timestamp: Date.now(),
      checksum: generateChecksum(JSON.stringify(value)),
    };
    
    const encoded = btoa(JSON.stringify(data));
    localStorage.setItem(STORAGE_PREFIX + key, encoded);
  } catch {
    console.error('Failed to store secure data:', _error);
  }
}

/**
 * Retrieve and verify stored data
 */
export function getSecureItem<T>(key: string): T | null {
  try {
    const encoded = localStorage.getItem(STORAGE_PREFIX + key);
    if (!encoded) return null;

    const data = JSON.parse(atob(encoded));
    const expectedChecksum = generateChecksum(JSON.stringify(data.value));
    
    if (data.checksum !== expectedChecksum) {
      console.warn('Data integrity check failed for:', _key);
      removeSecureItem(key);
      return null;
    }
    
    return data.value;
  } catch {
    console.error('Failed to retrieve secure data:', _error);
    return null;
  }
}

/**
 * Remove stored data
 */
export function removeSecureItem(key: string): void {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

export const SecureStorage = {
  setItem: setSecureItem,
  getItem: getSecureItem,
  removeItem: removeSecureItem
};