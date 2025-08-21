/**
 * Input validation and sanitization utilities
 */

// Sanitize user input to prevent XSS and other attacks
// Enterprise input validation
export function validateInput(input: string): { isValid: boolean; error?: string } {
  return sanitizeInput(input) === input 
    ? { isValid: true }
    : { isValid: false, error: 'Input contains potentially unsafe content' };
}

export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Preserve spaces if input is only whitespace
  if (input.trim() === '' && input.length > 0) {
    return input;
  }
  
  // Aggressively remove dangerous content and tags
  let cleaned = input
    // Remove script tags and their content first
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove all other HTML/XML tags
    .replace(/<[^>]*>/g, '')
    // Remove any remaining angle brackets
    .replace(/[<>]/g, '')
    // Remove javascript: protocols
    .replace(/javascript:/gi, '')
    // Remove data: protocols (can contain scripts)
    .replace(/data:/gi, '')
    // Remove vbscript: protocols
    .replace(/vbscript:/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    // Limit length to prevent DoS
    .substring(0, 10000);
  
  return cleaned.trim();
}

// Validate custom prompt content
export function validateCustomPrompt(prompt: string): { isValid: boolean; error?: string } {
  if (!prompt) {
    return { isValid: false, error: 'Prompt cannot be empty' };
  }
  
  if (prompt.length > 5000) {
    return { isValid: false, error: 'Prompt is too long (maximum 5000 characters)' };
  }
  
  // Check for potentially harmful content
  const dangerousPatterns = [
    /ignore\s+(previous|all)\s+instructions/i,
    /system\s*:\s*forget/i,
    /you\s+are\s+now/i,
    /jailbreak/i,
    /roleplay\s+as/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(prompt)) {
      return { isValid: false, error: 'Prompt contains potentially harmful content' };
    }
  }
  
  return { isValid: true };
}

// Validate API key format (basic check)
export function validateApiKey(apiKey: string): { isValid: boolean; error?: string } {
  if (!apiKey) {
    return { isValid: false, error: 'API key is required' };
  }
  
  // OpenAI API key format validation
  if (!apiKey.startsWith('sk-')) {
    return { isValid: false, error: 'Invalid API key format' };
  }
  
  if (apiKey.length < 40) {
    return { isValid: false, error: 'API key appears to be incomplete' };
  }
  
  return { isValid: true };
}

// Rate limiting helper
class RateLimiter {
  private readonly requests = new Map<string, number[]>();
  
  isAllowed(identifier: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }
    
    const requests = this.requests.get(identifier);
    
    // Remove old requests outside the window
    while (requests.length > 0 && requests[0] < windowStart) {
      requests.shift();
    }
    
    // Check if we're within limits
    if (requests.length >= maxRequests) {
      return false;
    }
    
    // Add current request
    requests.push(now);
    return true;
  }
  
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

// Validate session data
export function validateSessionData(session: any): boolean {
  if (!session || typeof session !== 'object') {
    throw new Error('Session must be an object');
  }
  
  if (!session.id) {
    throw new Error('Invalid session data');
  }
  
  if (!session.name) {
    throw new Error('Invalid session data');
  }
  
  if (!session.createdAt) {
    throw new Error('Invalid session data');
  }
  
  // Validate messages array
  if (!Array.isArray(session.messages)) {
    throw new Error('Invalid session data');
  }
  
  for (const message of session.messages) {
    if (!message.id || !message.role || !message.content || !message.timestamp) {
      throw new Error('Invalid message format');
    }
  }
  
  return true;
}

/**
 * Validates username format
 */
export const validateUsername = (username: string): { isValid: boolean; message?: string } => {
  if (!username || typeof username !== 'string') {
    return { isValid: false, message: 'Username is required' };
  }

  const trimmed = username.trim();
  
  if (trimmed.length < 3) {
    return { isValid: false, message: 'Username must be at least 3 characters long' };
  }
  
  if (trimmed.length > 20) {
    return { isValid: false, message: 'Username must be less than 20 characters long' };
  }
  
  // Allow alphanumeric, underscores, and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { isValid: false, message: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }
  
  // Must start with a letter or number
  if (!/^[a-zA-Z0-9]/.test(trimmed)) {
    return { isValid: false, message: 'Username must start with a letter or number' };
  }
  
  return { isValid: true };
};

/**
 * Validates display name format
 */
export const validateDisplayName = (displayName: string): { isValid: boolean; message?: string } => {
  if (!displayName || typeof displayName !== 'string') {
    return { isValid: false, message: 'Display name is required' };
  }

  const trimmed = displayName.trim();
  
  if (trimmed.length < 1) {
    return { isValid: false, message: 'Display name cannot be empty' };
  }
  
  if (trimmed.length > 50) {
    return { isValid: false, message: 'Display name must be less than 50 characters long' };
  }
  
  return { isValid: true };
};