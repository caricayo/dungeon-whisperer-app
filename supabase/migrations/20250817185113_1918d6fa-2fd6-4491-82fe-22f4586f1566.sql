-- Fix Critical Security Issues (Fixed version)

-- 1. Remove over-permissive session_participants INSERT policy
DROP POLICY IF EXISTS "Users can join sessions they're invited to" ON public.session_participants;
DROP POLICY IF EXISTS "System can insert session participants" ON public.session_participants;

-- Create more restrictive policy that requires proper authorization
CREATE POLICY "System can insert session participants"
ON public.session_participants
FOR INSERT
WITH CHECK (
  -- Only allow inserts through the join_multiplayer_session function or by session owners/DMs
  (
    EXISTS (
      SELECT 1 FROM public.sessions 
      WHERE id = session_participants.session_id 
      AND user_id = auth.uid()
    )
  ) OR (
    EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = session_participants.session_id 
      AND sp.user_id = auth.uid() 
      AND sp.role = 'dm'
    )
  )
);

-- 2. Fix update_user_presence RPC to prevent spoofing
CREATE OR REPLACE FUNCTION public.update_user_presence(user_id uuid, online_status boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.profiles 
  SET is_online = online_status, last_seen = now()
  WHERE id = user_id AND id = auth.uid(); -- Critical: Only allow updating own presence
$function$;

-- 3. Tighten api_usage INSERT policy
DROP POLICY IF EXISTS "System can insert API usage" ON public.api_usage;
DROP POLICY IF EXISTS "Authenticated users can insert their own API usage" ON public.api_usage;

CREATE POLICY "Authenticated users can insert their own API usage"
ON public.api_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);