-- Phase 1: Critical Database Fixes
-- Add Foreign Key Constraints for proper relationships

-- Add foreign key from session_participants.user_id to profiles.id
ALTER TABLE public.session_participants 
ADD CONSTRAINT fk_session_participants_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add foreign key from session_participants.session_id to sessions.id  
ALTER TABLE public.session_participants 
ADD CONSTRAINT fk_session_participants_session_id 
FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Add foreign key from session_invites.session_id to sessions.id
ALTER TABLE public.session_invites 
ADD CONSTRAINT fk_session_invites_session_id 
FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

-- Add foreign key from session_invites.inviter_id to profiles.id
ALTER TABLE public.session_invites 
ADD CONSTRAINT fk_session_invites_inviter_id 
FOREIGN KEY (inviter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add foreign key from session_invites.invitee_id to profiles.id
ALTER TABLE public.session_invites 
ADD CONSTRAINT fk_session_invites_invitee_id 
FOREIGN KEY (invitee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add Performance Indexes
CREATE INDEX IF NOT EXISTS idx_session_participants_session_user ON public.session_participants(session_id, user_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user ON public.session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_session_invites_invitee_status ON public.session_invites(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_multiplayer_updated ON public.sessions(is_multiplayer, updated_at);

-- Create security definer function to allow multiplayer participant profile viewing
CREATE OR REPLACE FUNCTION public.can_view_multiplayer_participant(participant_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants sp1
    JOIN public.session_participants sp2 ON sp1.session_id = sp2.session_id
    WHERE sp1.user_id = auth.uid() 
    AND sp2.user_id = participant_user_id
  );
$$;

-- Add RLS policy for multiplayer participant profile viewing
CREATE POLICY "Users can view profiles of multiplayer session participants" 
ON public.profiles 
FOR SELECT 
USING (can_view_multiplayer_participant(id));