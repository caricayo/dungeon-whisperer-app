/**
 * @fileoverview Unit tests for security utilities
 * Tests input sanitization, validation, and security logging
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputSanitizer, SecurityLogger } from './security';

describe('InputSanitizer', () => {
  describe('sanitizeText', () => {
    it('should remove dangerous HTML tags', () => {
      const dangerous = '<script>alert("xss")</script>Hello World';
      const result = InputSanitizer.sanitizeText(dangerous);
      expect(result).not.toContain('<script>');
      expect(result).toContain('Hello World');
    });

    it('should encode HTML entities', () => {
      const input = '<div>Test & "quotes"</div>';
      const result = InputSanitizer.sanitizeText(input);
      expect(result).toContain('&lt;div&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });

    it('should handle empty and null inputs safely', () => {
      expect(InputSanitizer.sanitizeText('')).toBe('');
      expect(InputSanitizer.sanitizeText('   ')).toBe('');
    });

    it('should preserve safe content', () => {
      const safe = 'Hello World! This is safe content.';
      const result = InputSanitizer.sanitizeText(safe);
      expect(result).toBe(safe);
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow safe URLs', () => {
      const safeUrl = 'https://example.com/path';
      const result = InputSanitizer.sanitizeUrl(safeUrl);
      expect(result).toBe(safeUrl);
    });

    it('should reject javascript URLs', () => {
      // eslint-disable-next-line no-script-url
      const dangerousUrl = 'javascript:alert("xss")';
      const result = InputSanitizer.sanitizeUrl(dangerousUrl);
      expect(result).toBe(null);
    });

    it('should reject malformed URLs', () => {
      const malformed = 'not-a-valid-url';
      const result = InputSanitizer.sanitizeUrl(malformed);
      expect(result).toBe(null);
    });

    it('should allow mailto URLs', () => {
      const mailto = 'mailto:test@example.com';
      const result = InputSanitizer.sanitizeUrl(mailto);
      expect(result).toBe(mailto);
    });
  });

  describe('sanitizeFileName', () => {
    it('should sanitize dangerous file names', () => {
      const dangerous = '../../../etc/passwd';
      const result = InputSanitizer.sanitizeFileName(dangerous);
      expect(result).not.toContain('../');
      expect(result).not.toContain('/');
    });

    it('should replace invalid characters with underscores', () => {
      const invalid = 'file<>:"|?*.txt';
      const result = InputSanitizer.sanitizeFileName(invalid);
      expect(result).toBe('file_________.txt');
    });

    it('should limit file name length', () => {
      const longName = 'a'.repeat(200) + '.txt';
      const result = InputSanitizer.sanitizeFileName(longName);
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });
});

describe('SecurityLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Mock implementation - intentionally empty
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('logSecurityEvent', () => {
    it('should log security events in development', () => {
      // Mock development environment
      vi.stubEnv('VITE_APP_ENV', 'development');
      
      SecurityLogger.logSecurityEvent('test_event', { test: 'data' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔒 Security Event:'),
        expect.objectContaining({
          event: 'test_event',
          details: { test: 'data' }
        })
      );
    });

    it('should redact sensitive information from logs', () => {
      const sensitiveData = {
        username: 'testuser',
        password: 'secret123',
        email: 'test@example.com',
        token: 'abc123'
      };

      SecurityLogger.logSecurityEvent('login_attempt', sensitiveData);

      // Check if password and token were redacted
      const logCall = consoleSpy.mock.calls[0];
      const loggedData = JSON.stringify(logCall);
      expect(loggedData).not.toContain('secret123');
      expect(loggedData).not.toContain('abc123');
      expect(loggedData).toContain('[REDACTED]');
    });

    it('should handle non-object details', () => {
      expect(() => {
        SecurityLogger.logSecurityEvent('string_test', 'simple string');
      }).not.toThrow();
    });
  });
});

describe('Error Handling Integration', () => {
  it('should handle security validation errors gracefully', () => {
    // Test that security functions don't throw on edge cases
    expect(() => InputSanitizer.sanitizeText(null as unknown as string)).not.toThrow();
    expect(() => InputSanitizer.sanitizeText(undefined as unknown as string)).not.toThrow();
    expect(() => InputSanitizer.sanitizeUrl(null as unknown as string)).not.toThrow();
    expect(() => InputSanitizer.sanitizeFileName(null as unknown as string)).not.toThrow();
  });
});

// Test data for edge cases
 
const testCases = {
  xssAttempts: [
    '<script>alert("xss")</script>',
    // eslint-disable-next-line no-script-url
    'javascript:alert(1)',
    'onload="alert(1)"',
     
    '<iframe src="javascript:alert(1)"></iframe>',
    '<img src="x" onerror="alert(1)">',
    '<svg onload="alert(1)">',
    'vbscript:msgbox(1)',
    '<style>@import url(javascript:alert(1))</style>'
  ],
  sqlInjectionAttempts: [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "1; DELETE FROM users WHERE 1=1; --",
    "' UNION SELECT * FROM passwords --"
  ],
  pathTraversalAttempts: [
    '../../../etc/passwd',
    '..\\..\\windows\\system32\\config\\sam',
    '/etc/shadow',
    '~/.ssh/id_rsa'
  ]
};

describe('Security Edge Cases', () => {
  it.each(testCases.xssAttempts)('should sanitize XSS attempt: %s', (xssPayload) => {
    const result = InputSanitizer.sanitizeText(xssPayload);
    expect(result).not.toContain('<script');
    // eslint-disable-next-line no-script-url
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('onload=');
    expect(result).not.toContain('onerror=');
  });

  it.each(testCases.pathTraversalAttempts)('should sanitize path traversal: %s', (pathPayload) => {
    const result = InputSanitizer.sanitizeFileName(pathPayload);
    expect(result).not.toContain('../');
    expect(result).not.toContain('..\\');
    expect(result).not.toContain('/etc/');
    expect(result).not.toContain('~/.ssh');
  });
});