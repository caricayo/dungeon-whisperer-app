-- Fix the ambiguous column reference in join_multiplayer_session function
CREATE OR REPLACE FUNCTION public.join_multiplayer_session(session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  session_record RECORD;
  participant_count INTEGER;
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Get session details (fully qualify the table name)
  SELECT s.id, s.name, s.custom_prompt, s.messages, s.max_players, s.is_multiplayer, s.current_player_count
  INTO session_record
  FROM public.sessions s 
  WHERE s.id = session_id AND s.is_multiplayer = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Multiplayer session not found');
  END IF;
  
  -- Check if user is already a participant (fully qualify column references)
  IF EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = join_multiplayer_session.session_id AND sp.user_id = current_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Already joined',
      'session', jsonb_build_object(
        'id', session_record.id,
        'name', session_record.name,
        'custom_prompt', session_record.custom_prompt,
        'messages', session_record.messages
      )
    );
  END IF;
  
  -- Check if session is full
  IF session_record.current_player_count >= COALESCE(session_record.max_players, 6) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session is full');
  END IF;
  
  -- Add user as participant (fully qualify all column references)
  INSERT INTO public.session_participants (session_id, user_id, role, permissions)
  VALUES (join_multiplayer_session.session_id, current_user_id, 'player', '{"can_invite": false}'::jsonb);
  
  -- Update player count (fully qualify column references)
  UPDATE public.sessions 
  SET current_player_count = current_player_count + 1,
      updated_at = now()
  WHERE id = join_multiplayer_session.session_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Successfully joined session',
    'session', jsonb_build_object(
      'id', session_record.id,
      'name', session_record.name,
      'custom_prompt', session_record.custom_prompt,
      'messages', session_record.messages
    )
  );
END;
$function$;