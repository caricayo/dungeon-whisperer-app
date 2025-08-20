-- ============================================================================
-- MULTIPLAYER SESSION JOIN FIXES - CONSOLIDATED MIGRATION
-- ============================================================================
-- This file contains all fixes for "could not join session" errors
-- Run this entire script in your Supabase SQL Editor or via CLI
-- ============================================================================

-- Step 1: Profile validation and helper functions
-- ============================================================================

-- Function to generate unique usernames for users without one
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

-- Function to validate user profile before joining sessions
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

-- Step 2: Enhanced session join function with comprehensive error handling
-- ============================================================================

CREATE OR REPLACE FUNCTION public.join_session_v2(session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  session_record RECORD;
  room_record RECORD;
  current_user_id uuid := auth.uid();
  user_profile RECORD;
  last_30_messages jsonb;
  members_data jsonb;
  participant_count INTEGER;
BEGIN
  -- Authentication check
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Authentication required. Please sign in to join sessions.'
    );
  END IF;

  -- Get and validate user profile
  SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Profile not found. Please complete your profile setup before joining sessions.',
      'action', 'create_profile'
    );
  END IF;
  
  -- Check if user has required profile data
  IF user_profile.username IS NULL OR user_profile.username = '' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Username required. Please set up your username before joining sessions.',
      'action', 'set_username'
    );
  END IF;

  -- Get session details with comprehensive validation
  SELECT s.id, s.name, s.custom_prompt, s.messages, s.max_players, s.is_multiplayer, 
         s.current_player_count, s.room_id, s.status, s.campaign_id, s.user_id
  INTO session_record
  FROM public.sessions s 
  WHERE s.id = session_id 
    AND s.deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Session not found. The session may have been deleted or the link is invalid.'
    );
  END IF;
  
  -- Check if session is multiplayer
  IF NOT session_record.is_multiplayer THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'This is not a multiplayer session.'
    );
  END IF;
  
  -- Check if session is active
  IF session_record.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Session is not active. Status: ' || session_record.status
    );
  END IF;
  
  -- Check current participant count accurately
  SELECT COUNT(*) INTO participant_count
  FROM public.session_participants sp
  WHERE sp.session_id = session_id;
  
  -- Check if user is already a participant
  IF EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = session_id AND sp.user_id = current_user_id
  ) THEN
    -- User is already a participant, continue with session setup
    RAISE LOG 'User % already participant in session %', current_user_id, session_id;
  ELSE
    -- Check if session is full before adding new participant
    IF participant_count >= COALESCE(session_record.max_players, 6) THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Session is full (' || participant_count || '/' || COALESCE(session_record.max_players, 6) || ' players). Please try again later or contact the session owner.'
      );
    END IF;
    
    -- Add user as participant
    BEGIN
      INSERT INTO public.session_participants (session_id, user_id, role, permissions)
      VALUES (session_id, current_user_id, 'player', '{"can_invite": false}'::jsonb);
      
      RAISE LOG 'Added user % as participant to session %', current_user_id, session_id;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Failed to join session: ' || SQLERRM
      );
    END;
  END IF;
  
  -- Create or get room
  IF session_record.room_id IS NULL THEN
    BEGIN
      INSERT INTO public.rooms (name, created_by)
      VALUES (session_record.name || ' Room', session_record.user_id)
      RETURNING * INTO room_record;
      
      -- Update session with room_id
      UPDATE public.sessions 
      SET room_id = room_record.id, updated_at = now()
      WHERE id = session_id;
      
      session_record.room_id := room_record.id;
      
      RAISE LOG 'Created room % for session %', room_record.id, session_id;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Failed to create room: ' || SQLERRM
      );
    END;
  ELSE
    SELECT * INTO room_record FROM public.rooms WHERE id = session_record.room_id;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Session room not found. Please contact the session owner.'
      );
    END IF;
  END IF;
  
  -- Get last 30 messages (simplified)
  last_30_messages := COALESCE(session_record.messages, '[]'::jsonb);
  
  -- Get all current members with display names
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', sp.user_id,
      'role', sp.role,
      'displayName', public.get_display_name(p.*),
      'username', p.username,
      'avatarUrl', p.avatar_url,
      'joinedAt', sp.joined_at,
      'isOnline', COALESCE(p.is_online, false)
    )
  ) INTO members_data
  FROM public.session_participants sp
  JOIN public.profiles p ON sp.user_id = p.id
  WHERE sp.session_id = session_id;
  
  RAISE LOG 'Successfully processed join for user % in session %', current_user_id, session_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'session', jsonb_build_object(
      'id', session_record.id,
      'name', session_record.name,
      'customPrompt', session_record.custom_prompt,
      'roomId', session_record.room_id,
      'maxPlayers', COALESCE(session_record.max_players, 6),
      'currentPlayerCount', participant_count + 1
    ),
    'room', jsonb_build_object(
      'id', session_record.room_id,
      'name', room_record.name
    ),
    'members', COALESCE(members_data, '[]'::jsonb),
    'last30Messages', last_30_messages,
    'userProfile', jsonb_build_object(
      'userId', current_user_id,
      'displayName', public.get_display_name(user_profile.*),
      'username', user_profile.username,
      'avatarUrl', user_profile.avatar_url
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Unexpected error in join_session_v2: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false, 
    'error', 'An unexpected error occurred while joining the session. Please try again or contact support.'
  );
END;
$function$;

-- Step 3: Create profiles for existing users without them
-- ============================================================================

DO $migration$
DECLARE
  user_record RECORD;
  generated_username text;
BEGIN
  RAISE LOG 'Starting profile creation for users without profiles...';
  
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
  
  RAISE LOG 'Profile creation migration completed successfully';
END $migration$;

-- ============================================================================
-- MIGRATION COMPLETED SUCCESSFULLY
-- ============================================================================
-- 
-- This migration has:
-- 1. ✅ Enhanced join_session_v2 with comprehensive error handling
-- 2. ✅ Added profile validation and auto-creation functions  
-- 3. ✅ Created profiles for existing users without them
-- 4. ✅ Added proper error messages and logging
--
-- Next steps:
-- 1. Test the join flow with existing users
-- 2. Test error scenarios (full sessions, invalid links, etc.)
-- 3. Monitor logs for any issues
-- 
-- ============================================================================