-- Add helper functions and improvements for profile validation

-- Function to ensure user has complete profile before joining sessions
CREATE OR REPLACE FUNCTION public.validate_user_profile_for_session(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_profile RECORD;
BEGIN
  -- Get user profile
  SELECT * INTO user_profile FROM public.profiles WHERE id = user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Profile not found',
      'action', 'create_profile'
    );
  END IF;
  
  -- Check username requirement
  IF user_profile.username IS NULL OR user_profile.username = '' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Username is required to join multiplayer sessions',
      'action', 'set_username'
    );
  END IF;
  
  -- Profile is valid
  RETURN jsonb_build_object(
    'valid', true,
    'profile', jsonb_build_object(
      'id', user_profile.id,
      'username', user_profile.username,
      'displayName', COALESCE(user_profile.display_name, user_profile.username),
      'avatarUrl', user_profile.avatar_url,
      'isOnline', COALESCE(user_profile.is_online, false)
    )
  );
END;
$function$;

-- Function to auto-generate username for users without one
CREATE OR REPLACE FUNCTION public.generate_username_for_user(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_username text;
  final_username text;
  counter integer := 1;
BEGIN
  -- Generate base username from user ID
  base_username := 'adventurer_' || substring(user_id::text from 1 for 8);
  final_username := base_username;
  
  -- Ensure username is unique
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || '_' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_username;
END;
$function$;

-- Function to setup minimal profile for new users
CREATE OR REPLACE FUNCTION public.setup_user_profile(
  user_id uuid,
  desired_username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  final_username text;
  user_email text;
BEGIN
  -- Check if profile already exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profile already exists'
    );
  END IF;
  
  -- Get user email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = user_id;
  
  -- Determine username
  IF desired_username IS NOT NULL AND desired_username != '' THEN
    -- Check if desired username is available
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = desired_username) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Username already taken'
      );
    END IF;
    final_username := desired_username;
  ELSE
    -- Generate username automatically
    final_username := public.generate_username_for_user(user_id);
  END IF;
  
  -- Create profile
  INSERT INTO public.profiles (id, username, display_name, created_at, updated_at)
  VALUES (
    user_id,
    final_username,
    final_username, -- Use username as initial display name
    now(),
    now()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'username', final_username,
    'message', 'Profile created successfully'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Failed to create profile: ' || SQLERRM
  );
END;
$function$;

-- Update existing users without profiles (migration helper)
DO $migration$
DECLARE
  user_record RECORD;
  generated_username text;
BEGIN
  -- Find auth users without profiles
  FOR user_record IN 
    SELECT au.id, au.email, au.created_at
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL
      AND au.email IS NOT NULL
  LOOP
    -- Generate username for this user
    generated_username := public.generate_username_for_user(user_record.id);
    
    -- Create basic profile
    INSERT INTO public.profiles (id, username, display_name, created_at, updated_at)
    VALUES (
      user_record.id,
      generated_username,
      generated_username,
      user_record.created_at,
      now()
    );
    
    RAISE LOG 'Created profile for user % with username %', user_record.id, generated_username;
  END LOOP;
END $migration$;