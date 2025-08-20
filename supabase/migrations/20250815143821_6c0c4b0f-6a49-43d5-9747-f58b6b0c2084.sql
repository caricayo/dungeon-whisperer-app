-- Fix infinite recursion in RLS policies by using security definer functions

-- Drop the problematic policies first
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can view multiplayer sessions they participate in" ON public.sessions;
DROP POLICY IF EXISTS "Users can discover open multiplayer sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can view participants in sessions they're part of" ON public.session_participants;
DROP POLICY IF EXISTS "Users can view participants of discoverable multiplayer sessions" ON public.session_participants;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.is_session_owner(session_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE id = session_id AND user_id = $2
  );
$$;

CREATE OR REPLACE FUNCTION public.is_session_participant_user(session_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants 
    WHERE session_id = $1 AND user_id = $2
  );
$$;

CREATE OR REPLACE FUNCTION public.is_multiplayer_session_discoverable(session_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE id = session_id 
    AND is_multiplayer = true 
    AND current_player_count < max_players
  );
$$;

-- Create new safe policies using security definer functions
CREATE POLICY "Users can view their own sessions" ON public.sessions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view sessions they participate in" ON public.sessions
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id OR 
    is_session_participant_user(id, auth.uid())
  )
);

-- Create safe policies for session participants
CREATE POLICY "Participants can view session participant data" ON public.session_participants
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id OR
    is_session_owner(session_id, auth.uid()) OR
    is_session_participant_user(session_id, auth.uid())
  )
);

CREATE POLICY "Users can view discoverable session participants" ON public.session_participants
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  is_multiplayer_session_discoverable(session_id)
);