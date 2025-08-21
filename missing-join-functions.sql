-- ============================================================================
-- MISSING MULTIPLAYER JOIN FUNCTIONS - SAFE DEPLOYMENT
-- ============================================================================
-- This creates the missing RPC functions needed for session joining
-- No DROP statements - safe for Supabase deployment
-- ============================================================================

-- Function 1: Validate user profile for session joining
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
      'action', 'create_profile',
      'error', 'Profile not found. Please complete your profile setup.'
    );
  END IF;
  
  IF user_profile.username IS NULL OR user_profile.username = '' THEN
    RETURN jsonb_build_object(
      'valid', false,
      'action', 'set_username',
      'error', 'Username required. Please set up your username before joining sessions.'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'profile', jsonb_build_object(
      'id', user_profile.id,
      'username', user_profile.username,
      'display_name', user_profile.display_name
    )
  );
END;
$function$;

-- Function 2: Setup user profile automatically
CREATE OR REPLACE FUNCTION public.setup_user_profile(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_username text;
  counter integer := 1;
  base_username text;
BEGIN
  -- Generate base username
  base_username := 'player_' || substring(user_id::text from 1 for 8);
  new_username := base_username;
  
  -- Ensure username is unique
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = new_username) LOOP
    new_username := base_username || '_' || counter;
    counter := counter + 1;
  END LOOP;
  
  -- Create or update profile
  INSERT INTO public.profiles (id, username, display_name, created_at, updated_at)
  VALUES (user_id, new_username, new_username, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name),
    updated_at = now();
    
  RETURN jsonb_build_object(
    'success', true,
    'username', new_username,
    'message', 'Profile created successfully'
  );
END;
$function$;

-- Function 3: Join session v2 with comprehensive error handling
CREATE OR REPLACE FUNCTION public.join_session_v2(session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  session_record RECORD;
  user_profile RECORD;
  existing_participant RECORD;
  room_id text;
BEGIN
  -- Authentication check
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required to join sessions'
    );
  END IF;
  
  -- Get session details
  SELECT * INTO session_record FROM public.sessions 
  WHERE id = session_id AND is_multiplayer = true AND deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Multiplayer session not found or has been deleted'
    );
  END IF;
  
  -- Check session status
  IF session_record.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session is not active. Status: ' || session_record.status
    );
  END IF;
  
  -- Validate user profile
  SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;
  
  IF NOT FOUND OR user_profile.username IS NULL OR user_profile.username = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'action', 'setup_profile',
      'error', 'Please complete your profile setup before joining sessions'
    );
  END IF;
  
  -- Check if already a participant
  SELECT * INTO existing_participant FROM public.session_participants 
  WHERE session_id = join_session_v2.session_id AND user_id = current_user_id;
  
  IF FOUND THEN
    -- Already a participant, return success with session data
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already a member of this session',
      'session', jsonb_build_object(
        'id', session_record.id,
        'name', session_record.name,
        'customPrompt', COALESCE(session_record.custom_prompt, ''),
        'roomId', session_record.id::text,
        'maxPlayers', session_record.max_players,
        'currentPlayerCount', session_record.current_player_count
      ),
      'userProfile', jsonb_build_object(
        'userId', user_profile.id,
        'username', user_profile.username,
        'displayName', COALESCE(user_profile.display_name, user_profile.username)
      ),
      'last30Messages', session_record.messages
    );
  END IF;
  
  -- Check session capacity
  IF session_record.current_player_count >= session_record.max_players THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session is at maximum capacity (' || session_record.max_players || ' players)'
    );
  END IF;
  
  -- Add user as participant
  INSERT INTO public.session_participants (
    session_id,
    user_id,
    role,
    permissions,
    joined_at
  )
  VALUES (
    join_session_v2.session_id,
    current_user_id,
    'player',  -- Use 'player' role (allowed by constraint)
    jsonb_build_object(
      'can_invite', false,
      'can_kick', false,
      'can_edit_session', false,
      'can_delete_session', false
    ),
    now()
  );
  
  -- Update session player count
  UPDATE public.sessions 
  SET current_player_count = current_player_count + 1,
      updated_at = now()
  WHERE id = join_session_v2.session_id;
  
  -- Return success with full session data
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Successfully joined the session',
    'session', jsonb_build_object(
      'id', session_record.id,
      'name', session_record.name,
      'customPrompt', COALESCE(session_record.custom_prompt, ''),
      'roomId', session_record.id::text,
      'maxPlayers', session_record.max_players,
      'currentPlayerCount', session_record.current_player_count + 1
    ),
    'userProfile', jsonb_build_object(
      'userId', user_profile.id,
      'username', user_profile.username,
      'displayName', COALESCE(user_profile.display_name, user_profile.username)
    ),
    'last30Messages', session_record.messages
  );
  
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in join_session_v2: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Failed to join session: ' || SQLERRM
  );
END;
$function$;

-- ============================================================================
-- DEPLOYMENT COMPLETE - MISSING JOIN FUNCTIONS
-- ============================================================================
-- 
-- ✅ validate_user_profile_for_session() - Validates user profiles
-- ✅ setup_user_profile() - Creates profiles for new users  
-- ✅ join_session_v2() - Comprehensive session joining with error handling
--
-- These functions enable:
-- - Profile validation before joining
-- - Automatic profile creation for new users
-- - Robust session joining with proper error messages
-- - Capacity checking and participant management
--
-- ============================================================================