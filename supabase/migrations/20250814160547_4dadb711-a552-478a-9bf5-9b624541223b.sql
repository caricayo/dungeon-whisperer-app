-- Create a function to get user ID by email (needed for friend requests)
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id FROM auth.users WHERE email = $1 LIMIT 1;
$$;

-- Enable realtime for social tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;

-- Set replica identity for realtime updates
ALTER TABLE public.friends REPLICA IDENTITY FULL;
ALTER TABLE public.session_invites REPLICA IDENTITY FULL;
ALTER TABLE public.session_participants REPLICA IDENTITY FULL;