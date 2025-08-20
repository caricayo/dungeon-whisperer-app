-- ============================================================================
-- MULTIPLAYER SESSION CREATION FUNCTION: create_multiplayer_session
-- ============================================================================
-- This function allows users to create multiplayer D&D sessions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_multiplayer_session(
  session_name text,
  custom_prompt text DEFAULT '',
  max_players integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  new_session_id uuid;
  user_profile RECORD;
BEGIN
  -- Authentication check
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required to create sessions'
    );
  END IF;
  
  -- Validate input
  IF session_name IS NULL OR trim(session_name) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session name is required'
    );
  END IF;
  
  IF max_players < 1 OR max_players > 20 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Max players must be between 1 and 20'
    );
  END IF;
  
  -- Get and validate user profile
  SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profile not found. Please complete your profile setup first.'
    );
  END IF;
  
  IF user_profile.username IS NULL OR user_profile.username = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Username required. Please set up your username before creating sessions.'
    );
  END IF;
  
  -- Generate new session ID
  new_session_id := gen_random_uuid();
  
  -- Create the multiplayer session
  BEGIN
    INSERT INTO public.sessions (
      id,
      user_id,
      name,
      custom_prompt,
      messages,
      is_multiplayer,
      max_players,
      current_player_count,
      status,
      created_at,
      updated_at
    )
    VALUES (
      new_session_id,
      current_user_id,
      trim(session_name),
      COALESCE(custom_prompt, ''),
      '[]'::jsonb,  -- Empty messages array
      true,         -- is_multiplayer = true
      max_players,
      1,            -- Creator counts as first player
      'active',
      now(),
      now()
    );
    
    -- Add creator as the first participant with admin role
    INSERT INTO public.session_participants (
      session_id,
      user_id,
      role,
      permissions,
      joined_at
    )
    VALUES (
      new_session_id,
      current_user_id,
      'admin',      -- Creator gets admin role
      jsonb_build_object(
        'can_invite', true,
        'can_kick', true,
        'can_edit_session', true,
        'can_delete_session', true
      ),
      now()
    );
    
    RAISE LOG 'Created multiplayer session % ("%") for user %', 
      new_session_id, session_name, current_user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'session_id', new_session_id,
      'session_name', trim(session_name),
      'max_players', max_players,
      'join_url', '/rooms/' || new_session_id || '/join',
      'message', 'Multiplayer session created successfully'
    );
    
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating multiplayer session: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to create session: ' || SQLERRM
    );
  END;

END;
$function$;