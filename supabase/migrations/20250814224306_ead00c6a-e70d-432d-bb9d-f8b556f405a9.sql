-- Security Fix: Enhanced RLS policies to prevent email harvesting and improve privacy

-- 1. Fix session_invites email harvesting vulnerability
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view invites they sent or received" ON session_invites;
DROP POLICY IF EXISTS "Users can update invites they received" ON session_invites;

-- Create secure policies that protect email addresses
CREATE POLICY "Users can view invites they sent" 
ON session_invites FOR SELECT 
USING (auth.uid() = inviter_id);

CREATE POLICY "Users can view invites they received (secure)" 
ON session_invites FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE users.id = auth.uid() 
    AND users.email = session_invites.invitee_email
  )
);

CREATE POLICY "Users can update invites they received (secure)" 
ON session_invites FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE users.id = auth.uid() 
    AND users.email = session_invites.invitee_email
  )
);

-- 2. Enhance profiles privacy - require authentication to view profiles
-- Drop existing policy first
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Create authenticated-only policy
CREATE POLICY "Authenticated users can view profiles" 
ON profiles FOR SELECT 
USING (auth.role() = 'authenticated');

-- 3. Secure database functions by adding proper search_path
-- Update existing functions to be more secure
CREATE OR REPLACE FUNCTION public.update_user_presence(user_id uuid, online_status boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.profiles 
  SET is_online = online_status, last_seen = now()
  WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_user_by_username(username_to_find text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.profiles 
  WHERE LOWER(username) = LOWER(username_to_find)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_username_available(username_to_check text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(username) = LOWER(username_to_check)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role_in_session(session_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.session_participants 
  WHERE session_id = $1 AND user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_session_participant(session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants 
    WHERE session_id = $1 AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_invite_to_session(session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = $1 
    AND sp.user_id = auth.uid()
    AND (sp.role = 'dm' OR (sp.permissions->>'can_invite')::boolean = true)
  );
$$;