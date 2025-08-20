-- Create database schema for multiplayer features
-- Friends system
CREATE TABLE public.friends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- Session participants for multiplayer campaigns
CREATE TABLE public.session_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('dm', 'player')),
  permissions JSONB DEFAULT '{"can_edit": false, "can_invite": false}',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- Session invites
CREATE TABLE public.session_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  inviter_id UUID NOT NULL,
  invitee_email TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(session_id, invitee_email)
);

-- Map data for sessions
ALTER TABLE public.dnd_sessions 
ADD COLUMN map_data JSONB DEFAULT '{"markers": [], "areas": [], "notes": []}',
ADD COLUMN is_multiplayer BOOLEAN DEFAULT false,
ADD COLUMN max_participants INTEGER DEFAULT 6;

-- Enable Row Level Security on new tables
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for friends table
CREATE POLICY "Users can view their own friendships"
ON public.friends FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friend requests"
ON public.friends FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their friend requests"
ON public.friends FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete their friendships"
ON public.friends FOR DELETE
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- RLS Policies for session_participants
CREATE POLICY "Participants can view session participants"
ON public.session_participants FOR SELECT
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.session_participants sp2 
    WHERE sp2.session_id = session_participants.session_id 
    AND sp2.user_id = auth.uid()
  )
);

CREATE POLICY "DMs can manage participants"
ON public.session_participants FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.session_participants sp 
    WHERE sp.session_id = session_participants.session_id 
    AND sp.user_id = auth.uid() 
    AND sp.role = 'dm'
  )
);

CREATE POLICY "Users can join sessions they're invited to"
ON public.session_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for session_invites
CREATE POLICY "Users can view invites they sent or received"
ON public.session_invites FOR SELECT
USING (
  auth.uid() = inviter_id OR 
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = session_invites.invitee_email
  )
);

CREATE POLICY "Participants can create invites"
ON public.session_invites FOR INSERT
WITH CHECK (
  auth.uid() = inviter_id AND
  EXISTS (
    SELECT 1 FROM public.session_participants sp 
    WHERE sp.session_id = session_invites.session_id 
    AND sp.user_id = auth.uid()
    AND (sp.role = 'dm' OR (sp.permissions->>'can_invite')::boolean = true)
  )
);

CREATE POLICY "Users can update invites they received"
ON public.session_invites FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = session_invites.invitee_email
  )
);

-- Update triggers for timestamps
CREATE TRIGGER update_friends_updated_at
BEFORE UPDATE ON public.friends
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime on new tables for live collaboration
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dnd_sessions;