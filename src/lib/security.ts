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
export class InputSanitizer {
  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi,
    /<form\b[^>]*>/gi,
  ];

  /**
   * Sanitize HTML content by removing dangerous patterns
   */
  static sanitizeHtml(input: string): string {
    if (typeof input !== 'string') return '';
    
    let sanitized = input;
    
    this.DANGEROUS_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    
    return sanitized.trim();
  }

  /**
   * Sanitize text input for safe display
   */
  static sanitizeText(input: string): string {
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
  static sanitizeUrl(url: string): string | null {
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
  static sanitizeFileName(fileName: string): string {
    if (typeof fileName !== 'string') return 'unnamed-file';
    
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase()
      .slice(0, 100); // Limit length
  }
}

/**
 * Security logger for audit trails  
 */
export class SecurityLogger {
  private static readonly PII_PATTERNS = [
    /\b[\w._%+-]+@[\w.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
    /\b\d{3}-?\d{2}-?\d{4}\b/g, // SSN
    /password/gi,
    /secret/gi,
    /token/gi,
  ];

  /**
   * Log security event with PII redaction
   */
  static logSecurityEvent(event: string, details: Record<string, unknown>): void {
    const sanitizedDetails = SecurityLogger.sanitizeLogData(details);
    
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

  /**
   * Sanitize log data by redacting PII
   */
  private static sanitizeLogData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        let sanitizedValue = value;
        
        SecurityLogger.PII_PATTERNS.forEach(pattern => {
          sanitizedValue = sanitizedValue.replace(pattern, '[REDACTED]');
        });
        
        sanitized[key] = sanitizedValue;
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

/**
 * Secure storage utilities
 */
export class SecureStorage {
  private static readonly STORAGE_PREFIX = 'dnd_secure_';

  /**
   * Securely store data in localStorage with basic obfuscation
   */
  static setItem(key: string, value: unknown): void {
    try {
      const data = {
        value,
        timestamp: Date.now(),
        checksum: this.generateChecksum(JSON.stringify(value)),
      };
      
      const encoded = btoa(JSON.stringify(data));
      localStorage.setItem(this.STORAGE_PREFIX + key, encoded);
    } catch (error) {
      console.error('Failed to store secure data:', error);
    }
  }

  /**
   * Retrieve and verify stored data
   */
  static getItem<T>(key: string): T | null {
    try {
      const encoded = localStorage.getItem(this.STORAGE_PREFIX + key);
      if (!encoded) return null;

      const data = JSON.parse(atob(encoded));
      const expectedChecksum = this.generateChecksum(JSON.stringify(data.value));
      
      if (data.checksum !== expectedChecksum) {
        console.warn('Data integrity check failed for:', key);
        this.removeItem(key);
        return null;
      }
      
      return data.value;
    } catch (error) {
      console.error('Failed to retrieve secure data:', error);
      return null;
    }
  }

  /**
   * Remove stored data
   */
  static removeItem(key: string): void {
    localStorage.removeItem(this.STORAGE_PREFIX + key);
  }

  /**
   * Generate simple checksum for data integrity
   */
  private static generateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}