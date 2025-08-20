-- Create display name resolver function
CREATE OR REPLACE FUNCTION public.get_display_name(user_profile_row public.profiles)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    user_profile_row.display_name,
    user_profile_row.username,
    'Adventurer-' || substring(user_profile_row.id::text from 1 for 8)
  );
$$;

-- Create session join function with room management
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
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Get session details with soft delete filter
  SELECT s.id, s.name, s.custom_prompt, s.messages, s.max_players, s.is_multiplayer, 
         s.current_player_count, s.room_id, s.status, s.campaign_id, s.user_id
  INTO session_record
  FROM public.sessions s 
  WHERE s.id = session_id 
    AND s.is_multiplayer = true 
    AND s.deleted_at IS NULL
    AND s.status = 'active';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active multiplayer session not found');
  END IF;
  
  -- Create room if it doesn't exist
  IF session_record.room_id IS NULL THEN
    INSERT INTO public.rooms (name, created_by)
    VALUES (session_record.name || ' Room', session_record.user_id)
    RETURNING * INTO room_record;
    
    -- Update session with room_id
    UPDATE public.sessions 
    SET room_id = room_record.id, updated_at = now()
    WHERE id = session_id;
    
    session_record.room_id := room_record.id;
  ELSE
    SELECT * INTO room_record FROM public.rooms WHERE id = session_record.room_id;
  END IF;
  
  -- Check if user is already a participant
  IF NOT EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = session_id AND sp.user_id = current_user_id
  ) THEN
    -- Check if session is full
    IF session_record.current_player_count >= COALESCE(session_record.max_players, 6) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Session is full');
    END IF;
    
    -- Add user as participant
    INSERT INTO public.session_participants (session_id, user_id, role, permissions)
    VALUES (session_id, current_user_id, 'player', '{"can_invite": false}'::jsonb);
  END IF;
  
  -- Get user profile for display name
  SELECT * INTO user_profile FROM public.profiles WHERE id = current_user_id;
  
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
      'joinedAt', sp.joined_at
    )
  ) INTO members_data
  FROM public.session_participants sp
  JOIN public.profiles p ON sp.user_id = p.id
  WHERE sp.session_id = session_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'session', jsonb_build_object(
      'id', session_record.id,
      'name', session_record.name,
      'customPrompt', session_record.custom_prompt,
      'roomId', session_record.room_id
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
END;
$function$;