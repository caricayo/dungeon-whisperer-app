-- Enhanced session join function with better error handling and profile validation
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
      'error', 'Profile not found. Please complete your profile setup before joining sessions.'
    );
  END IF;
  
  -- Check if user has required profile data
  IF user_profile.username IS NULL OR user_profile.username = '' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Username required. Please set up your username before joining sessions.',
      'action', 'setup_profile'
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