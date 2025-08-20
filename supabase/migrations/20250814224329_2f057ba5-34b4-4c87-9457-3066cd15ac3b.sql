-- Fix remaining function security warning
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- We'll let the frontend handle profile creation after username is chosen
  RETURN NEW;
END;
$$;