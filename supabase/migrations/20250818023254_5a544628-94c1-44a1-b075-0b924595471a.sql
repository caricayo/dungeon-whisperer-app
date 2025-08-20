-- Fix search path for display name function
CREATE OR REPLACE FUNCTION public.get_display_name(user_profile_row public.profiles)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    user_profile_row.display_name,
    user_profile_row.username,
    'Adventurer-' || substring(user_profile_row.id::text from 1 for 8)
  );
$$;