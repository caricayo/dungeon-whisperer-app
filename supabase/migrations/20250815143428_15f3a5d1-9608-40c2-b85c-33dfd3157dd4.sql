-- Phase 1: Update RLS policies to allow multiplayer session discovery

-- Update sessions table to allow viewing of public multiplayer sessions
DROP POLICY IF EXISTS "Users can view sessions they own or participate in" ON public.sessions;

-- Create new policies for better multiplayer session visibility
CREATE POLICY "Users can view their own sessions" ON public.sessions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view multiplayer sessions they participate in" ON public.sessions  
FOR SELECT USING (
  is_multiplayer = true AND (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.session_participants sp 
      WHERE sp.session_id = sessions.id AND sp.user_id = auth.uid()
    )
  )
);

-- Allow discovery of open multiplayer sessions (not at max capacity)
CREATE POLICY "Users can discover open multiplayer sessions" ON public.sessions
FOR SELECT USING (
  is_multiplayer = true AND 
  current_player_count < max_players AND
  auth.uid() IS NOT NULL
);

-- Update session_participants to allow viewing participants of discoverable sessions  
DROP POLICY IF EXISTS "Users can view participants in their sessions" ON public.session_participants;

CREATE POLICY "Users can view participants in sessions they're part of" ON public.session_participants
FOR SELECT USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.sessions s 
    WHERE s.id = session_participants.session_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view participants of discoverable multiplayer sessions" ON public.session_participants  
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.sessions s 
    WHERE s.id = session_participants.session_id AND 
          s.is_multiplayer = true AND 
          s.current_player_count < s.max_players AND
          auth.uid() IS NOT NULL
  )
);