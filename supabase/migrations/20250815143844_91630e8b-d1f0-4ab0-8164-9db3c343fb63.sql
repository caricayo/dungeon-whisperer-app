-- Fix infinite recursion in RLS policies - take 2 with unique names

-- Drop ALL existing policies on sessions table to start clean
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can view sessions they participate in" ON public.sessions;
DROP POLICY IF EXISTS "Users can view sessions they own or participate in" ON public.sessions;
DROP POLICY IF EXISTS "Users can view multiplayer sessions they participate in" ON public.sessions;
DROP POLICY IF EXISTS "Users can discover open multiplayer sessions" ON public.sessions;

-- Drop ALL existing policies on session_participants table
DROP POLICY IF EXISTS "Users can view participants in sessions they're part of" ON public.session_participants;
DROP POLICY IF EXISTS "Users can view participants of discoverable multiplayer sessions" ON public.session_participants;
DROP POLICY IF EXISTS "Users can view participants in their sessions" ON public.session_participants;
DROP POLICY IF EXISTS "Participants can view session participant data" ON public.session_participants;
DROP POLICY IF EXISTS "Users can view discoverable session participants" ON public.session_participants;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.is_session_owner_safe(session_id uuid, user_id uuid)
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

CREATE OR REPLACE FUNCTION public.is_participant_safe(session_id uuid, user_id uuid)
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

-- Create new safe policies for sessions table
CREATE POLICY "session_owner_access" ON public.sessions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "session_participant_access" ON public.sessions
FOR SELECT USING (
  auth.uid() IS NOT NULL AND 
  is_participant_safe(id, auth.uid())
);

-- Create new safe policies for session_participants table  
CREATE POLICY "participant_data_access" ON public.session_participants
FOR SELECT USING (
  auth.uid() IS NOT NULL AND (
    auth.uid() = user_id OR
    is_session_owner_safe(session_id, auth.uid())
  )
);