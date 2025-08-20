import { describe, it, expect } from 'vitest';
import { sanitizeInput, validateSessionData } from '@/lib/validation';

describe('validation utilities', () => {
  describe('sanitizeInput', () => {
    it('removes dangerous HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = sanitizeInput(input);
      expect(result).toBe('Hello');
      expect(result).not.toContain('<script>');
    });

    it('preserves safe content', () => {
      const input = 'Hello world, this is a safe message!';
      const result = sanitizeInput(input);
      expect(result).toBe(input);
    });

    it('handles empty input', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput('   ')).toBe('   ');
    });

    it('removes multiple dangerous tags', () => {
      const input = '<script>evil()</script><iframe src="bad"></iframe>Safe content';
      const result = sanitizeInput(input);
      expect(result).toBe('Safe content');
    });

    it('handles nested dangerous tags', () => {
      const input = '<div><script>nested()</script></div>Safe';
      const result = sanitizeInput(input);
      expect(result).toBe('Safe');
    });
  });

  describe('validateSessionData', () => {
    const validSession = {
      id: 'test-id',
      name: 'Test Session',
      messages: [],
      customPrompt: '',
      createdAt: new Date(),
    };

    it('validates correct session data', () => {
      expect(() => validateSessionData(validSession)).not.toThrow();
    });

    it('throws on missing id', () => {
      const invalidSession = { ...validSession, id: undefined };
      expect(() => validateSessionData(invalidSession)).toThrow('Invalid session data');
    });

    it('throws on missing name', () => {
      const invalidSession = { ...validSession, name: '' };
      expect(() => validateSessionData(invalidSession)).toThrow('Invalid session data');
    });

    it('throws on invalid messages array', () => {
      const invalidSession = { ...validSession, messages: 'not-an-array' };
      expect(() => validateSessionData(invalidSession)).toThrow('Invalid session data');
    });

    it('throws on missing createdAt', () => {
      const invalidSession = { ...validSession, createdAt: undefined };
      expect(() => validateSessionData(invalidSession)).toThrow('Invalid session data');
    });

    it('validates session with messages', () => {
      const sessionWithMessages = {
        ...validSession,
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            timestamp: new Date(),
          },
        ],
      };
      
      expect(() => validateSessionData(sessionWithMessages)).not.toThrow();
    });
  });
});