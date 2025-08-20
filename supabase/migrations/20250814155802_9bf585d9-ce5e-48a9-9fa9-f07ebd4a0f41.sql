-- Fix security warning: Enable leaked password protection
-- This needs to be done via auth config, but let's ensure all functions have proper security

-- Create secure helper functions with proper search_path
CREATE OR REPLACE FUNCTION public.get_user_role_in_session(session_id UUID)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.session_participants 
  WHERE session_id = $1 AND user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_session_participant(session_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants 
    WHERE session_id = $1 AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_invite_to_session(session_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = $1 
    AND sp.user_id = auth.uid()
    AND (sp.role = 'dm' OR (sp.permissions->>'can_invite')::boolean = true)
  );
$$;