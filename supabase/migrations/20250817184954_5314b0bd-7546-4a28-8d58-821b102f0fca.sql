-- Fix Critical Security Issues

-- 1. Remove over-permissive session_participants INSERT policy
DROP POLICY IF EXISTS "Users can join sessions they're invited to" ON public.session_participants;

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

CREATE POLICY "Authenticated users can insert their own API usage"
ON public.api_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- 4. Add SET search_path to security-sensitive functions for additional protection
CREATE OR REPLACE FUNCTION public.is_session_owner(session_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE id = session_id AND user_id = $2
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_session_participant_user(session_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants 
    WHERE session_id = $1 AND user_id = $2
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_multiplayer_session_discoverable(session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE id = session_id 
    AND is_multiplayer = true 
    AND current_player_count < max_players
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    CASE 
      WHEN profile_user_id = auth.uid() THEN true
      ELSE EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = profile_user_id
        AND (
          (p.privacy_settings->>'profile_visibility' = 'public')
          OR 
          (
            p.privacy_settings->>'profile_visibility' = 'friends'
            AND EXISTS (
              SELECT 1 FROM public.friendships f
              WHERE ((f.user_id = auth.uid() AND f.friend_id = profile_user_id) 
                     OR (f.user_id = profile_user_id AND f.friend_id = auth.uid()))
              AND f.status = 'accepted'
            )
          )
        )
      )
    END;
$function$;

CREATE OR REPLACE FUNCTION public.check_friend_operation_rate_limit(operation_type text, max_operations integer DEFAULT 10, window_minutes integer DEFAULT 5)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id UUID := auth.uid();
  operation_count INTEGER;
  window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  window_start := now() - (window_minutes || ' minutes')::INTERVAL;
  
  SELECT COUNT(*)
  FROM public.friend_operation_rate_limits
  WHERE user_id = current_user_id
    AND operation_type = check_friend_operation_rate_limit.operation_type
    AND window_start > check_friend_operation_rate_limit.window_start
  INTO operation_count;
  
  IF operation_count >= max_operations THEN
    RETURN FALSE;
  END IF;
  
  INSERT INTO public.friend_operation_rate_limits (user_id, operation_type)
  VALUES (current_user_id, check_friend_operation_rate_limit.operation_type);
  
  RETURN TRUE;
END;
$function$;