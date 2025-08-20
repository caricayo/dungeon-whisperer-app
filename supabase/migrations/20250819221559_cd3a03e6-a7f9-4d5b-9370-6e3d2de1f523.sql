-- Phase 2: Database Reliability Upgrades
-- Fix RLS policies and enable proper realtime functionality

-- Enable realtime for key tables
ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER TABLE public.session_participants REPLICA IDENTITY FULL; 
ALTER TABLE public.session_invites REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Fix rooms table RLS policy for creation
CREATE POLICY "Anyone can create rooms" ON public.rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Improve session creation efficiency - add index
CREATE INDEX IF NOT EXISTS idx_sessions_multiplayer_world ON public.sessions (is_multiplayer, world, current_player_count) WHERE is_multiplayer = true AND deleted_at IS NULL;

-- Improve participant queries
CREATE INDEX IF NOT EXISTS idx_session_participants_session_user ON public.session_participants (session_id, user_id);

-- Improve profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username) WHERE username IS NOT NULL;

-- Add function to reset all username_reset_required flags safely
CREATE OR REPLACE FUNCTION public.fix_username_reset_flags()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only clear the flag for users who have valid, non-generated usernames
  UPDATE public.profiles 
  SET username_reset_required = false, 
      updated_at = now()
  WHERE username_reset_required = true 
    AND username IS NOT NULL 
    AND LENGTH(username) >= 3
    AND username !~ '^user_[0-9a-f]{8}$'  -- Don't clear for auto-generated usernames
    AND username ~ '^[a-zA-Z0-9_]+$';     -- Only clear for valid usernames

  RETURN true;
END;
$$;