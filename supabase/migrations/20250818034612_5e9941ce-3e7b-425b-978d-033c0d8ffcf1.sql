-- Add username reset flag to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username_reset_required boolean DEFAULT true;

-- Update existing users to require username reset
UPDATE public.profiles 
SET username_reset_required = true 
WHERE username_reset_required IS NULL;

-- Create function to safely get all users for world directory
CREATE OR REPLACE FUNCTION public.get_all_users_safe()
RETURNS TABLE(
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_online boolean,
  last_seen timestamp with time zone,
  current_world smallint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.is_online,
    p.last_seen,
    p.current_world
  FROM public.profiles p
  WHERE p.username IS NOT NULL
  ORDER BY p.is_online DESC, p.last_seen DESC;
$$;

-- Create function to reset user's username
CREATE OR REPLACE FUNCTION public.reset_user_username()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.profiles 
  SET username_reset_required = true,
      updated_at = now()
  WHERE id = current_user_id;

  RETURN true;
END;
$$;