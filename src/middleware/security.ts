import { RATE_LIMITS, SecurityLogger } from '@/lib/security';

/**
 * Rate limiter for client-side request limiting
 */
class ClientRateLimit {
  private static instance: ClientRateLimit;
  private readonly requestCounts = new Map<string, { count: number; resetTime: number }>();

  static getInstance(): ClientRateLimit {
    if (!ClientRateLimit.instance) {
      ClientRateLimit.instance = new ClientRateLimit();
    }
    return ClientRateLimit.instance;
  }

  /**
   * Check if request is within rate limits
   */
  checkLimit(
    identifier: string, 
    maxRequests: number = RATE_LIMITS.api.maxRequests, 
    windowMs: number = RATE_LIMITS.api.windowMs
  ): boolean {
    const now = Date.now();
    const key = `${identifier}:${Math.floor(now / windowMs)}`;
    
    const current = this.requestCounts.get(key);
    
    if (!current) {
      this.requestCounts.set(key, { count: 1, resetTime: now + windowMs });
      this.cleanup();
      return true;
    }
    
    if (current.count >= maxRequests) {
      SecurityLogger.logSecurityEvent('rate_limit_exceeded', {
        identifier,
        limit: maxRequests,
        window: windowMs,
      });
      return false;
    }
    
    current.count++;
    return true;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, data] of this.requestCounts.entries()) {
      if (now > data.resetTime) {
        this.requestCounts.delete(key);
      }
    }
  }
}

/**
 * Request interceptor for API calls with security checks
 */
export const SecureRequest = {
  rateLimiter: ClientRateLimit.getInstance(),

  /**
   * Make a secure API request with rate limiting and validation
   */
  async request<T>(
    url: string,
    options: RequestInit = {},
    rateLimit: { maxRequests: number; windowMs: number } = RATE_LIMITS.api
  ): Promise<T> {
    // Rate limiting check
    const identifier = this.getRequestIdentifier(url);
    if (!this.rateLimiter.checkLimit(identifier, rateLimit.maxRequests, rateLimit.windowMs)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Security headers
    const secureHeaders = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    };

    // CSRF protection for state-changing requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || 'GET')) {
      const csrfToken = this.getCSRFToken();
      if (csrfToken) {
        secureHeaders['X-CSRF-Token'] = csrfToken;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers: secureHeaders,
      credentials: 'same-origin', // CSRF protection
    });

    // Log suspicious responses
    if (!response.ok && response.status >= 400) {
      SecurityLogger.logSecurityEvent('api_error', {
        url,
        status: response.status,
        method: options.method || 'GET',
      });
    }

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Generate request identifier for rate limiting
   */
  getRequestIdentifier(url: string): string {
    // Use combination of URL path and user session
    const urlPath = new URL(url, window.location.origin).pathname;
    const sessionId = sessionStorage.getItem('session_id') || 'anonymous';
    return `${urlPath}:${sessionId}`;
  },

  /**
   * Get or generate CSRF token
   */
  getCSRFToken(): string | null {
    // In a real app, this would be set by the server
    let token = sessionStorage.getItem('csrf_token');
    
    if (!token) {
      token = this.generateCSRFToken();
      sessionStorage.setItem('csrf_token', token);
    }
    
    return token;
  },

  /**
   * Generate a simple CSRF token
   */
  generateCSRFToken(): string {
    return btoa(
      Date.now().toString() + 
      Math.random().toString(36).substr(2, 9)
    );
  }
};

/**
 * Security event handlers
 */
export const securityHandlers = {
  /**
   * Handle potential XSS attempt
   */
  handleXSSAttempt: (payload: string) => {
    SecurityLogger.logSecurityEvent('xss_attempt', { payload: payload.slice(0, 100) });
  },

  /**
   * Handle unauthorized access attempt
   */
  handleUnauthorizedAccess: (resource: string) => {
    SecurityLogger.logSecurityEvent('unauthorized_access', { resource });
  },

  /**
   * Handle suspicious activity
   */
  handleSuspiciousActivity: (activity: string, details: Record<string, unknown>) => {
    SecurityLogger.logSecurityEvent('suspicious_activity', { activity, ...details });
  },
};