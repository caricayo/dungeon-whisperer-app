-- Update API usage table to support proper RLS and Context-7 Doc Assist compliance
-- Add missing columns for comprehensive API usage tracking

-- Add new columns to support better tracking
ALTER TABLE public.api_usage ADD COLUMN IF NOT EXISTS endpoint text;
ALTER TABLE public.api_usage ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;
ALTER TABLE public.api_usage ADD COLUMN IF NOT EXISTS demo_mode_blocked boolean DEFAULT false;
ALTER TABLE public.api_usage ADD COLUMN IF NOT EXISTS response_time_ms integer;
ALTER TABLE public.api_usage ADD COLUMN IF NOT EXISTS error_message text;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_api_usage_user_created ON public.api_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_service_created ON public.api_usage(service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_demo_blocked ON public.api_usage(demo_mode_blocked, created_at DESC) WHERE demo_mode_blocked = true;

-- Create a function to log API usage with demo mode tracking
CREATE OR REPLACE FUNCTION public.log_api_usage(
  p_service text,
  p_operation text,
  p_endpoint text DEFAULT NULL,
  p_session_id uuid DEFAULT NULL,
  p_tokens_used integer DEFAULT 0,
  p_cost_estimate numeric DEFAULT 0,
  p_demo_mode_blocked boolean DEFAULT false,
  p_response_time_ms integer DEFAULT NULL,
  p_error_message text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  usage_id uuid;
  current_user_id uuid := auth.uid();
BEGIN
  -- Allow unauthenticated logging for demo mode tracking
  IF current_user_id IS NULL AND NOT p_demo_mode_blocked THEN
    RAISE EXCEPTION 'Authentication required for API usage logging';
  END IF;

  INSERT INTO public.api_usage (
    user_id,
    service,
    operation,
    endpoint,
    session_id,
    tokens_used,
    cost_estimate,
    demo_mode_blocked,
    response_time_ms,
    error_message
  ) VALUES (
    current_user_id,
    p_service,
    p_operation,
    p_endpoint,
    p_session_id,
    p_tokens_used,
    p_cost_estimate,
    p_demo_mode_blocked,
    p_response_time_ms,
    p_error_message
  )
  RETURNING id INTO usage_id;

  RETURN usage_id;
END;
$$;

-- Update RLS policies to allow demo mode logging
DROP POLICY IF EXISTS "Authenticated users can insert their own API usage" ON public.api_usage;
CREATE POLICY "Users can insert API usage including demo mode tracking" 
ON public.api_usage 
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id AND auth.uid() IS NOT NULL) OR 
  (demo_mode_blocked = true AND user_id IS NULL)
);

-- Create a view for API usage analytics (respecting RLS)
CREATE OR REPLACE VIEW public.api_usage_analytics AS
SELECT 
  service,
  operation,
  COUNT(*) as total_calls,
  SUM(CASE WHEN demo_mode_blocked THEN 1 ELSE 0 END) as blocked_calls,
  SUM(tokens_used) as total_tokens,
  SUM(cost_estimate) as total_cost,
  AVG(response_time_ms) as avg_response_time,
  DATE_TRUNC('day', created_at) as usage_date
FROM public.api_usage
WHERE (auth.uid() = user_id OR demo_mode_blocked = true)
GROUP BY service, operation, DATE_TRUNC('day', created_at)
ORDER BY usage_date DESC, total_calls DESC;