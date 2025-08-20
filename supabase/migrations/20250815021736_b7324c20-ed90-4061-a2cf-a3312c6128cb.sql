-- Phase 1: Critical Database & Auth Fixes

-- 1. Fix Sessions RLS Policy Infinite Recursion
-- Create security definer function to check session participation
CREATE OR REPLACE FUNCTION public.is_user_session_participant(check_session_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM session_participants 
    WHERE session_id = check_session_id 
    AND user_id = check_user_id
  );
$$;

-- Drop the problematic policy and create a new one using the security definer function
DROP POLICY IF EXISTS "Users can view sessions they own or participate in" ON sessions;

CREATE POLICY "Users can view sessions they own or participate in"
ON sessions FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.is_user_session_participant(id, auth.uid())
);

-- 2. Ensure sessions table is properly set up for realtime
ALTER TABLE sessions REPLICA IDENTITY FULL;

-- Add sessions to realtime publication if not already added
DO $$
BEGIN
  -- Check if sessions is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
  END IF;
END $$;

-- 3. Add session_participants to realtime for multiplayer functionality
ALTER TABLE session_participants REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'session_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE session_participants;
  END IF;
END $$;

-- 4. Add session_invites to realtime for invite notifications
ALTER TABLE session_invites REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'session_invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE session_invites;
  END IF;
END $$;

-- 5. Ensure profiles table has proper indexes for presence queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen);

-- 6. Add indexes for session queries performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON session_participants(user_id);

-- 7. Clean up any orphaned session data (safety check)
DELETE FROM session_participants 
WHERE session_id NOT IN (SELECT id FROM sessions);

DELETE FROM session_invites 
WHERE session_id NOT IN (SELECT id FROM sessions);