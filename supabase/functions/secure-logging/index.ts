import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

interface RateLimit {
  userId: string;
  lastRequest: number;
  requestCount: number;
}

const rateLimitMap = new Map<string, RateLimit>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit) {
    rateLimitMap.set(userId, { userId, lastRequest: now, requestCount: 1 });
    return true;
  }

  // Reset window if expired
  if (now - userLimit.lastRequest > RATE_LIMIT_WINDOW) {
    userLimit.requestCount = 1;
    userLimit.lastRequest = now;
    return true;
  }

  // Check if within limits
  if (userLimit.requestCount >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  userLimit.requestCount++;
  return true;
}

function sanitizeLogData(data: any): any {
  if (!data) return data;
  
  const sensitiveKeys = ['password', 'token', 'apikey', 'secret', 'key', 'auth', 'credential'];
  
  if (typeof data === 'string') {
    // Redact potential sensitive data patterns
    return data.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
               .replace(/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g, '[CARD_REDACTED]');
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => keyLower.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogData(value);
      }
    }
    
    return sanitized;
  }
  
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { logs } = await req.json();

    if (!Array.isArray(logs)) {
      return new Response(
        JSON.stringify({ error: 'Invalid log format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize and process logs
    const sanitizedLogs = logs.map((log: LogEntry) => ({
      ...log,
      userId: user.id,
      metadata: sanitizeLogData(log.metadata),
      message: sanitizeLogData(log.message),
      timestamp: new Date().toISOString(),
    }));

    // Send to external logging service if configured
    const logEndpoint = Deno.env.get('LOG_ENDPOINT');
    const logApiKey = Deno.env.get('LOG_API_KEY');

    if (logEndpoint && logApiKey) {
      try {
        await fetch(logEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${logApiKey}`
          },
          body: JSON.stringify({ logs: sanitizedLogs })
        });
      } catch (error) {
        console.error('Failed to send logs to external service:', error);
      }
    }

    // Store in local audit log for debugging
    console.log('Processing secure logs:', sanitizedLogs.length, 'entries');

    return new Response(
      JSON.stringify({ success: true, processed: sanitizedLogs.length }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Secure logging error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});