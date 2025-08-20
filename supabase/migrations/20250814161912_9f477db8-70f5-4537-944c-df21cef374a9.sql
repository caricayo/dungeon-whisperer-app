-- Fix function search paths for security compliance
CREATE OR REPLACE FUNCTION public.get_user_by_username(username_to_find text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id FROM public.profiles 
  WHERE LOWER(username) = LOWER(username_to_find)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_username_available(username_to_check text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(username) = LOWER(username_to_check)
  );
$$;

CREATE OR REPLACE FUNCTION public.update_user_presence(user_id uuid, online_status boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.profiles 
  SET is_online = online_status, last_seen = now()
  WHERE id = user_id;
$$;