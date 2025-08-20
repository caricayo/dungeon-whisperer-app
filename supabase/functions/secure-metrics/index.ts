import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

interface RateLimit {
  userId: string;
  lastRequest: number;
  requestCount: number;
}

const rateLimitMap = new Map<string, RateLimit>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 200; // Higher limit for metrics

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit) {
    rateLimitMap.set(userId, { userId, lastRequest: now, requestCount: 1 });
    return true;
  }

  if (now - userLimit.lastRequest > RATE_LIMIT_WINDOW) {
    userLimit.requestCount = 1;
    userLimit.lastRequest = now;
    return true;
  }

  if (userLimit.requestCount >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  userLimit.requestCount++;
  return true;
}

function sanitizeMetricTags(tags: Record<string, string>): Record<string, string> {
  const sanitizedTags: Record<string, string> = {};
  const sensitiveKeys = ['password', 'token', 'apikey', 'secret', 'key', 'auth'];
  
  for (const [key, value] of Object.entries(tags)) {
    const keyLower = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => keyLower.includes(sensitive))) {
      sanitizedTags[key] = '[REDACTED]';
    } else {
      // Limit tag value length to prevent abuse
      sanitizedTags[key] = String(value).substring(0, 100);
    }
  }
  
  return sanitizedTags;
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

    const { metrics } = await req.json();

    if (!Array.isArray(metrics)) {
      return new Response(
        JSON.stringify({ error: 'Invalid metrics format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and sanitize metrics
    const sanitizedMetrics = metrics.map((metric: Metric) => {
      // Validate metric structure
      if (!metric.name || typeof metric.value !== 'number') {
        throw new Error('Invalid metric structure');
      }

      return {
        name: String(metric.name).substring(0, 100), // Limit name length
        value: Number(metric.value),
        timestamp: new Date(),
        tags: {
          ...sanitizeMetricTags(metric.tags || {}),
          userId: user.id // Always include user ID
        },
        type: metric.type || 'counter'
      };
    }).filter(metric => 
      // Filter out potentially malicious metrics
      !metric.name.includes('__') && 
      metric.name.match(/^[a-zA-Z][a-zA-Z0-9._-]*$/)
    );

    // Send to external metrics service if configured
    const metricsEndpoint = Deno.env.get('METRICS_ENDPOINT');
    const metricsApiKey = Deno.env.get('METRICS_API_KEY');

    if (metricsEndpoint && metricsApiKey) {
      try {
        await fetch(metricsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${metricsApiKey}`
          },
          body: JSON.stringify({ metrics: sanitizedMetrics })
        });
      } catch (error) {
        console.error('Failed to send metrics to external service:', error);
      }
    }

    console.log('Processing secure metrics:', sanitizedMetrics.length, 'entries');

    return new Response(
      JSON.stringify({ success: true, processed: sanitizedMetrics.length }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Secure metrics error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});