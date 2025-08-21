-- ============================================================================
-- MULTIPLAYER FUNCTIONS DEPLOYMENT - BOTH FUNCTIONS COMBINED
-- ============================================================================
-- Copy this entire script and run it in your Supabase SQL Editor
-- ============================================================================

-- FUNCTION 1: CREATE MULTIPLAYER SESSION
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

-- ============================================================================
-- FUNCTION 2: APPEND SESSION MESSAGES  
-- ============================================================================
CREATE OR REPLACE FUNCTION public.append_session_messages(
  session_id uuid,
  user_message jsonb,
  assistant_message jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  session_record RECORD;
  current_user_id uuid := auth.uid();
  current_messages jsonb;
  updated_messages jsonb;
BEGIN
  -- Authentication check
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required to append messages'
    );
  END IF;

  -- Get session details
  SELECT s.id, s.messages, s.is_multiplayer, s.status, s.deleted_at
  INTO session_record
  FROM public.sessions s
  WHERE s.id = append_session_messages.session_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session not found'
    );
  END IF;
  
  -- Check if session is deleted
  IF session_record.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session has been deleted'
    );
  END IF;
  
  -- Check if session is multiplayer
  IF NOT session_record.is_multiplayer THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This function is only for multiplayer sessions'
    );
  END IF;
  
  -- Check if session is active
  IF session_record.status != 'active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session is not active. Status: ' || session_record.status
    );
  END IF;
  
  -- Check if user is a participant in this session
  IF NOT EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = append_session_messages.session_id 
      AND sp.user_id = current_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You are not a participant in this session'
    );
  END IF;
  
  -- Get current messages
  current_messages := COALESCE(session_record.messages, '[]'::jsonb);
  
  -- Append new messages to the existing messages array
  updated_messages := current_messages;
  
  -- Add user message first
  IF user_message IS NOT NULL THEN
    updated_messages := updated_messages || jsonb_build_array(user_message);
  END IF;
  
  -- Add assistant message second
  IF assistant_message IS NOT NULL THEN
    updated_messages := updated_messages || jsonb_build_array(assistant_message);
  END IF;
  
  -- Update the session with new messages
  UPDATE public.sessions
  SET 
    messages = updated_messages,
    updated_at = now()
  WHERE id = append_session_messages.session_id;
  
  -- Log the successful append
  RAISE LOG 'Successfully appended messages to multiplayer session % by user %', 
    append_session_messages.session_id, current_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'messages_added', CASE 
      WHEN user_message IS NOT NULL AND assistant_message IS NOT NULL THEN 2
      WHEN user_message IS NOT NULL OR assistant_message IS NOT NULL THEN 1
      ELSE 0
    END,
    'total_messages', jsonb_array_length(updated_messages)
  );

EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error in append_session_messages: %', SQLERRM;
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Failed to append messages: ' || SQLERRM
  );
END;
$function$;

-- ============================================================================
-- DEPLOYMENT COMPLETE
-- ============================================================================
-- 
-- ✅ create_multiplayer_session() - Creates secure multiplayer D&D sessions
-- ✅ append_session_messages() - Syncs chat messages across all participants
--
-- These functions enable:
-- - Multiplayer session creation from the Sessions page
-- - Real-time chat synchronization 
-- - Proper authentication and validation
-- - Detailed error handling
--
-- ============================================================================