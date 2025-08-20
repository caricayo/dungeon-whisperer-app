-- ============================================================================
-- MULTIPLAYER CHAT FUNCTION: append_session_messages
-- ============================================================================
-- This function allows users to append messages to multiplayer sessions
-- It handles both user and assistant messages in a single transaction
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