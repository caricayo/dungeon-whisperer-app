-- Create session_invites table for multiplayer session invitations
CREATE TABLE public.session_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL,
  invitee_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, invitee_id)
);

-- Create session_participants table to track multiplayer session members  
CREATE TABLE public.session_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('dm', 'player')),
  permissions JSONB NOT NULL DEFAULT '{"can_invite": false}'::jsonb,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Add multiplayer fields to sessions table
ALTER TABLE public.sessions 
ADD COLUMN is_multiplayer BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN max_players INTEGER DEFAULT 6,
ADD COLUMN current_player_count INTEGER NOT NULL DEFAULT 1;

-- Enable RLS on new tables
ALTER TABLE public.session_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_invites
CREATE POLICY "Users can view their own invites" 
ON public.session_invites 
FOR SELECT 
USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "Users can send invites to sessions they own or have DM role"
ON public.session_invites 
FOR INSERT 
WITH CHECK (
  auth.uid() = inviter_id AND (
    -- Session owner
    EXISTS (SELECT 1 FROM public.sessions WHERE id = session_id AND user_id = auth.uid())
    OR 
    -- DM in multiplayer session
    EXISTS (
      SELECT 1 FROM public.session_participants sp 
      WHERE sp.session_id = session_invites.session_id 
      AND sp.user_id = auth.uid() 
      AND sp.role = 'dm'
    )
  )
);

CREATE POLICY "Users can update invite status"
ON public.session_invites 
FOR UPDATE 
USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- RLS Policies for session_participants
CREATE POLICY "Users can view participants in their sessions"
ON public.session_participants 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.session_participants sp 
    WHERE sp.session_id = session_participants.session_id 
    AND sp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join sessions they're invited to"
ON public.session_participants 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "DMs can manage participants"
ON public.session_participants 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.session_participants sp 
    WHERE sp.session_id = session_participants.session_id 
    AND sp.user_id = auth.uid() 
    AND sp.role = 'dm'
  )
);

CREATE POLICY "Users can leave sessions"
ON public.session_participants 
FOR DELETE 
USING (auth.uid() = user_id);

-- Update sessions table policies to include multiplayer access
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
CREATE POLICY "Users can view their own sessions or sessions they participate in" 
ON public.sessions 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.session_participants sp 
    WHERE sp.session_id = sessions.id 
    AND sp.user_id = auth.uid()
  )
);

-- Create triggers for updated_at
CREATE TRIGGER update_session_invites_updated_at
BEFORE UPDATE ON public.session_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;

-- Set replica identity for realtime updates
ALTER TABLE public.session_invites REPLICA IDENTITY FULL;
ALTER TABLE public.session_participants REPLICA IDENTITY FULL;