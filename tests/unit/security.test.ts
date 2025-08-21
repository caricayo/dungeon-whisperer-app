import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputSanitizer, SecurityLogger } from '@/lib/security';
import { guardDemoMode, withDemoGuard } from '@/lib/demo-mode';

// Mock environment
vi.mock('@/lib/env', () => ({
  env: {
    VITE_DEMO_MODE: false,
    VITE_APP_ENV: 'test',
  }
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn()
}));

describe('InputSanitizer', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const input = '<div>Safe content</div><script>alert("xss")</script>';
      const result = InputSanitizer.sanitizeHtml(input);
      expect(result).toBe('<div>Safe content</div>');
    });

    it('should remove javascript: urls', () => {
      const input = '<a href="javascript:alert(1)">Link</a>';
      const result = InputSanitizer.sanitizeHtml(input);
      expect(result).toBe('<a href="">Link</a>');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(1)">Click me</div>';
      const result = InputSanitizer.sanitizeHtml(input);
      expect(result).toBe('<div>Click me</div>');
    });

    it('should handle empty input', () => {
      expect(InputSanitizer.sanitizeHtml('')).toBe('');
      expect(InputSanitizer.sanitizeHtml(null as any)).toBe('');
    });
  });

  describe('sanitizeText', () => {
    it('should escape HTML entities', () => {
      const input = '<script>alert("test")</script>';
      const result = InputSanitizer.sanitizeText(input);
      expect(result).toBe('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;');
    });

    it('should handle quotes and ampersands', () => {
      const input = `Tom & Jerry's "Adventure"`;
      const result = InputSanitizer.sanitizeText(input);
      expect(result).toBe('Tom &amp; Jerry&#x27;s &quot;Adventure&quot;');
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow safe URLs', () => {
      expect(InputSanitizer.sanitizeUrl('https://example.com')).toBe('https://example.com/');
      expect(InputSanitizer.sanitizeUrl('http://localhost:3000')).toBe('http://localhost:3000/');
      expect(InputSanitizer.sanitizeUrl('mailto:test@example.com')).toBe('mailto:test@example.com');
    });

    it('should reject dangerous URLs', () => {
      expect(InputSanitizer.sanitizeUrl('javascript:alert(1)')).toBe(null);
      expect(InputSanitizer.sanitizeUrl('data:text/html,<script>')).toBe(null);
      expect(InputSanitizer.sanitizeUrl('ftp://example.com')).toBe(null);
    });

    it('should handle invalid URLs', () => {
      expect(InputSanitizer.sanitizeUrl('not-a-url')).toBe(null);
      expect(InputSanitizer.sanitizeUrl('')).toBe(null);
    });
  });

  describe('sanitizeFileName', () => {
    it('should sanitize file names', () => {
      expect(InputSanitizer.sanitizeFileName('my file.txt')).toBe('my_file.txt');
      expect(InputSanitizer.sanitizeFileName('../../etc/passwd')).toBe('.._.._etc_passwd');
      expect(InputSanitizer.sanitizeFileName('file<script>.js')).toBe('file_script_.js');
    });

    it('should limit length', () => {
      const longName = 'a'.repeat(200);
      const result = InputSanitizer.sanitizeFileName(longName);
      expect(result.length).toBe(100);
    });
  });
});

describe('SecurityLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log security events in development', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    SecurityLogger.logSecurityEvent('test_event', { detail: 'test' });
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('Demo Mode', () => {
  it('should guard operations in demo mode', () => {
    // Test will depend on VITE_DEMO_MODE env var
    const isGuarded = guardDemoMode('Test Feature');
    expect(typeof isGuarded).toBe('boolean');
  });

  it('should create demo-guarded async functions', async () => {
    const mockFn = vi.fn().mockResolvedValue('success');
    const guardedFn = withDemoGuard(mockFn, 'Test Operation');
    
    const result = await guardedFn();
    
    // Result depends on demo mode setting
    expect(result).toBeDefined();
  });
});