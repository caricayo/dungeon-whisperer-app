-- Fix security definer view issue for API usage analytics
-- Remove the security definer view and create a safe function instead

DROP VIEW IF EXISTS public.api_usage_analytics;

-- Create a secure function for API usage analytics instead of a security definer view
CREATE OR REPLACE FUNCTION public.get_api_usage_analytics(
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL
)
RETURNS TABLE(
  service text,
  operation text,
  total_calls bigint,
  blocked_calls bigint,
  total_tokens bigint,
  total_cost numeric,
  avg_response_time numeric,
  usage_date date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT 
    api_usage.service,
    api_usage.operation,
    COUNT(*) as total_calls,
    SUM(CASE WHEN demo_mode_blocked THEN 1 ELSE 0 END) as blocked_calls,
    SUM(tokens_used) as total_tokens,
    SUM(cost_estimate) as total_cost,
    AVG(response_time_ms) as avg_response_time,
    created_at::date as usage_date
  FROM public.api_usage
  WHERE (auth.uid() = user_id OR demo_mode_blocked = true)
    AND (start_date IS NULL OR created_at::date >= start_date)
    AND (end_date IS NULL OR created_at::date <= end_date)
  GROUP BY service, operation, created_at::date
  ORDER BY usage_date DESC, total_calls DESC;
$$;