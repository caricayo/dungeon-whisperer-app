-- Create rate limiting table for edge functions
CREATE TABLE IF NOT EXISTS public.edge_function_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own rate limit data" 
ON public.edge_function_rate_limits 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert rate limit data" 
ON public.edge_function_rate_limits 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update rate limit data" 
ON public.edge_function_rate_limits 
FOR UPDATE 
USING (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_edge_function_rate_limits_user_function_window 
ON public.edge_function_rate_limits (user_id, function_name, window_start);

-- Create function to check rate limits
CREATE OR REPLACE FUNCTION public.check_edge_function_rate_limit(
  p_user_id UUID,
  p_function_name TEXT,
  p_max_requests INTEGER DEFAULT 60,
  p_window_minutes INTEGER DEFAULT 1
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  window_start_time TIMESTAMP WITH TIME ZONE;
  current_requests INTEGER;
BEGIN
  window_start_time := now() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Clean up old records
  DELETE FROM public.edge_function_rate_limits 
  WHERE window_start < window_start_time;
  
  -- Get current request count
  SELECT COALESCE(SUM(request_count), 0)
  INTO current_requests
  FROM public.edge_function_rate_limits
  WHERE user_id = p_user_id 
    AND function_name = p_function_name
    AND window_start >= window_start_time;
  
  -- Check if limit exceeded
  IF current_requests >= p_max_requests THEN
    RETURN FALSE;
  END IF;
  
  -- Record this request
  INSERT INTO public.edge_function_rate_limits (user_id, function_name, request_count)
  VALUES (p_user_id, p_function_name, 1)
  ON CONFLICT (user_id, function_name, window_start)
  DO UPDATE SET 
    request_count = edge_function_rate_limits.request_count + 1;
  
  RETURN TRUE;
END;
$$;

-- Create rate limit cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete rate limit records older than 1 hour
  DELETE FROM public.edge_function_rate_limits 
  WHERE window_start < now() - INTERVAL '1 hour';
END;
$$;