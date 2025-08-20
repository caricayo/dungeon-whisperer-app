/**
 * @fileoverview Unit tests for tech detection utility
 */

import { describe, it, expect } from 'vitest';
import { 
  detectTechTerms, 
  generateContext7Url, 
  shouldShowContext7Suggestion 
} from '@/lib/tech-detection';

describe('detectTechTerms', () => {
  it('should detect React terms', () => {
    const result = detectTechTerms('I need help with React components and hooks');
    expect(result.hasTechTerms).toBe(true);
    expect(result.detectedTechs).toContain('react');
    expect(result.suggestedQuery).toContain('react');
  });

  it('should detect TypeScript terms', () => {
    const result = detectTechTerms('How do I define TypeScript interfaces?');
    expect(result.hasTechTerms).toBe(true);
    expect(result.detectedTechs).toContain('typescript');
    expect(result.suggestedQuery).toContain('typescript');
  });

  it('should detect multiple technologies', () => {
    const result = detectTechTerms('Using React with TypeScript and Supabase');
    expect(result.hasTechTerms).toBe(true);
    expect(result.detectedTechs.length).toBeGreaterThan(1);
    expect(result.detectedTechs).toContain('react');
    expect(result.detectedTechs).toContain('typescript');
    expect(result.detectedTechs).toContain('supabase');
  });

  it('should handle empty input', () => {
    const result = detectTechTerms('');
    expect(result.hasTechTerms).toBe(false);
    expect(result.detectedTechs).toEqual([]);
    expect(result.suggestedQuery).toBe('');
  });

  it('should handle non-technical input', () => {
    const result = detectTechTerms('Hello, how are you today?');
    expect(result.hasTechTerms).toBe(false);
    expect(result.detectedTechs).toEqual([]);
  });

  it('should be case insensitive', () => {
    const result = detectTechTerms('REACT and TYPESCRIPT');
    expect(result.hasTechTerms).toBe(true);
    expect(result.detectedTechs).toContain('react');
    expect(result.detectedTechs).toContain('typescript');
  });

  it('should handle invalid input types', () => {
    const result = detectTechTerms(null as any);
    expect(result.hasTechTerms).toBe(false);
    expect(result.detectedTechs).toEqual([]);
  });
});

describe('generateContext7Url', () => {
  it('should generate base URL when no query provided', () => {
    const url = generateContext7Url('');
    expect(url).toBe('https://context7.com');
  });

  it('should generate URL with encoded query', () => {
    const url = generateContext7Url('react typescript');
    expect(url).toBe('https://context7.com/?q=react%20typescript');
  });

  it('should handle special characters in query', () => {
    const url = generateContext7Url('react & typescript');
    expect(url).toBe('https://context7.com/?q=react%20%26%20typescript');
  });
});

describe('shouldShowContext7Suggestion', () => {
  it('should return true by default', () => {
    const result = shouldShowContext7Suggestion({});
    expect(result).toBe(true);
  });

  it('should return true when explicitly enabled', () => {
    const result = shouldShowContext7Suggestion({ context7Enabled: true });
    expect(result).toBe(true);
  });

  it('should return false when explicitly disabled', () => {
    const result = shouldShowContext7Suggestion({ context7Enabled: false });
    expect(result).toBe(false);
  });

  it('should handle undefined settings', () => {
    const result = shouldShowContext7Suggestion(undefined);
    expect(result).toBe(true);
  });
});