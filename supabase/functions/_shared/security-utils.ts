/**
 * Security utilities for Supabase Edge Functions
 * Provides input sanitization, rate limiting, authentication helpers, and security headers
 */

// Security headers for enhanced protection
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self' https://api.openai.com https://api.elevenlabs.io https://replicate.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache'
};

// Input sanitization utilities
export function sanitizeString(input: unknown, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    return String(input).substring(0, maxLength);
  }
  
  // Remove potentially dangerous patterns
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/[<>]/g, '') // Remove HTML brackets
    .substring(0, maxLength)
    .trim();
}

export function sanitizeObject(obj: any, maxDepth: number = 3): any {
  if (maxDepth <= 0) return '[MAX_DEPTH_REACHED]';
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.slice(0, 100).map(item => sanitizeObject(item, maxDepth - 1));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    const sensitiveKeys = ['password', 'token', 'apikey', 'secret', 'key', 'auth', 'credential'];
    
    for (const [key, value] of Object.entries(obj)) {
      if (Object.keys(sanitized).length >= 50) break; // Limit object size
      
      const keyLower = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => keyLower.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[sanitizeString(key, 100)] = sanitizeObject(value, maxDepth - 1);
      }
    }
    
    return sanitized;
  }
  
  return String(obj).substring(0, 1000);
}

export function validateMessageArray(messages: unknown): boolean {
  if (!Array.isArray(messages)) return false;
  if (messages.length === 0 || messages.length > 50) return false;
  
  return messages.every(msg => {
    if (!msg || typeof msg !== 'object') return false;
    const message = msg as any;
    
    // Check required properties
    if (!message.role || !message.content) return false;
    if (typeof message.role !== 'string' || typeof message.content !== 'string') return false;
    
    // Validate role values
    const validRoles = ['user', 'assistant', 'system'];
    if (!validRoles.includes(message.role)) return false;
    
    // Check content length
    if (message.content.length > 10000) return false;
    
    return true;
  });
}

// Rate limiting helper
export async function checkRateLimit(
  supabase: any,
  userId: string,
  functionName: string,
  maxRequests: number = 60,
  windowMinutes: number = 1
): Promise<{ allowed: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('check_edge_function_rate_limit', {
      p_user_id: userId,
      p_function_name: functionName,
      p_max_requests: maxRequests,
      p_window_minutes: windowMinutes
    });

    if (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true }; // Fail open for availability
    }

    if (!data) {
      return { 
        allowed: false, 
        error: `Rate limit exceeded: ${maxRequests} requests per ${windowMinutes} minute(s)` 
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return { allowed: true }; // Fail open for availability
  }
}

// Authentication helper
export async function authenticateRequest(
  supabase: any, 
  authHeader: string | null
): Promise<{ user: any; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return { user: null, error: 'Invalid authentication token' };
    }

    return { user };
  } catch (error) {
    console.error('Authentication error:', error);
    return { user: null, error: 'Authentication failed' };
  }
}

// Standard error responses
export function createErrorResponse(
  message: string, 
  status: number = 400, 
  corsHeaders: Record<string, string>
) {
  return new Response(
    JSON.stringify({ error: message }),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

export function createRateLimitResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ 
      error: 'Rate limit exceeded', 
      details: 'Too many requests. Please try again later.' 
    }),
    { 
      status: 429, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Retry-After': '60'
      }
    }
  );
}

export function createSuccessResponse(
  data: any, 
  corsHeaders: Record<string, string>
) {
  return new Response(
    JSON.stringify(data),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

// Enhanced CORS headers with security and origin validation
export function createSecureCorsHeaders(origin?: string): Record<string, string> {
  // Production-ready origin validation
  const allowedOrigins = [
    'http://localhost:8080',
    'http://localhost:3000', 
    'http://localhost:5173', // Vite dev server
    // Add your production domains here
    // 'https://yourdomain.com',
    // 'https://www.yourdomain.com'
  ];
  
  const isDevelopment = Deno.env.get('ENVIRONMENT') !== 'production';
  const isAllowedOrigin = origin && allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isDevelopment ? '*' : (isAllowedOrigin ? origin : 'null'),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id, x-correlation-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 hours preflight cache
    'Access-Control-Expose-Headers': 'x-request-id, x-ratelimit-remaining, x-ratelimit-reset',
    'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
    ...securityHeaders
  };
}

// Enhanced request validation with comprehensive checks
export function validateChatRequest(body: any): { valid: boolean; error?: string } {
  // Check if body exists and is an object
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { messages, customPrompt, metadata, demoMode } = body;

  // Validate messages array
  if (!validateMessageArray(messages)) {
    return { valid: false, error: 'Invalid messages format' };
  }

  // Validate custom prompt if provided
  if (customPrompt !== undefined && customPrompt !== null) {
    if (typeof customPrompt !== 'string' || customPrompt.length > 5000) {
      return { valid: false, error: 'Invalid custom prompt' };
    }
  }

  // Validate metadata if provided
  if (metadata !== undefined && metadata !== null) {
    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      return { valid: false, error: 'Invalid metadata format' };
    }
    
    // Check for reasonable metadata size
    if (JSON.stringify(metadata).length > 2000) {
      return { valid: false, error: 'Metadata too large' };
    }
  }

  // Validate demo mode flag
  if (demoMode !== undefined && typeof demoMode !== 'boolean') {
    return { valid: false, error: 'Invalid demo mode flag' };
  }

  return { valid: true };
}

// Request logging for security monitoring
export async function logSecurityEvent(
  supabase: any,
  eventType: 'rate_limit' | 'auth_failure' | 'validation_error' | 'suspicious_activity',
  details: any,
  userAgent?: string,
  ipAddress?: string
): Promise<void> {
  try {
    await supabase
      .from('security_audit_log')
      .insert({
        action: eventType,
        resource_type: 'edge_function',
        resource_id: details.functionName || 'unknown',
        user_agent: userAgent,
        ip_address: ipAddress,
        // Store sanitized details only
        metadata: sanitizeObject(details, 2)
      });
  } catch (error) {
    console.error('Failed to log security event:', error);
    // Don't throw - logging failures shouldn't break functionality
  }
}