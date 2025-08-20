-- Fix remaining security function search path issues

CREATE OR REPLACE FUNCTION public.accept_friend_request(friend_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE public.friendships 
  SET status = 'accepted', updated_at = now()
  WHERE friend_id = auth.uid() 
    AND user_id = friend_user_id 
    AND status = 'pending';
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_friend_request(target_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_user_id UUID;
  existing_friendship friendship_status;
BEGIN
  SELECT id INTO target_user_id 
  FROM public.profiles 
  WHERE LOWER(username) = LOWER(target_username);
  
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF target_user_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot friend yourself');
  END IF;
  
  SELECT status INTO existing_friendship
  FROM public.friendships 
  WHERE (user_id = auth.uid() AND friend_id = target_user_id)
     OR (user_id = target_user_id AND friend_id = auth.uid());
  
  IF existing_friendship IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Friendship already exists');
  END IF;
  
  INSERT INTO public.friendships (user_id, friend_id, status)
  VALUES (auth.uid(), target_user_id, 'pending');
  
  RETURN jsonb_build_object('success', true, 'message', 'Friend request sent');
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_friend_request_by_user_id(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_profile RECORD;
  existing_friendship friendship_status;
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT id, username INTO target_profile 
  FROM public.profiles 
  WHERE id = target_user_id;
  
  IF target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF target_user_id = current_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot friend yourself');
  END IF;
  
  SELECT status INTO existing_friendship
  FROM public.friendships 
  WHERE (user_id = current_user_id AND friend_id = target_user_id)
     OR (user_id = target_user_id AND friend_id = current_user_id);
  
  IF existing_friendship IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Friendship already exists');
  END IF;
  
  INSERT INTO public.friendships (user_id, friend_id, status)
  VALUES (current_user_id, target_user_id, 'pending');
  
  RETURN jsonb_build_object('success', true, 'message', 'Friend request sent to ' || COALESCE(target_profile.username, 'user'));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_discoverable_sessions_for_current_world()
RETURNS TABLE(id uuid, name text, current_player_count integer, max_players integer, world smallint, created_at timestamp with time zone, owner_id uuid, owner_username text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_world smallint;
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT current_world INTO user_world 
  FROM public.profiles 
  WHERE id = current_user_id;
  
  IF user_world IS NULL THEN
    user_world := 1;
  END IF;
  
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.current_player_count,
    s.max_players,
    s.world,
    s.created_at,
    s.user_id as owner_id,
    p.username as owner_username
  FROM public.sessions s
  LEFT JOIN public.profiles p ON s.user_id = p.id
  WHERE s.is_multiplayer = true 
    AND s.current_player_count < COALESCE(s.max_players, 6)
    AND s.world = user_world
    AND s.user_id != current_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.session_participants sp 
      WHERE sp.session_id = s.id AND sp.user_id = current_user_id
    )
  ORDER BY s.created_at DESC;
END;
$function$;

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

  SELECT id, name, custom_prompt, messages, max_players, is_multiplayer, current_player_count
  INTO session_record
  FROM public.sessions 
  WHERE id = session_id AND is_multiplayer = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Multiplayer session not found');
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.session_participants 
    WHERE session_id = session_id AND user_id = current_user_id
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
  
  IF session_record.current_player_count >= COALESCE(session_record.max_players, 6) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session is full');
  END IF;
  
  INSERT INTO public.session_participants (session_id, user_id, role, permissions)
  VALUES (session_id, current_user_id, 'player', '{"can_invite": false}'::jsonb);
  
  UPDATE public.sessions 
  SET current_player_count = current_player_count + 1,
      updated_at = now()
  WHERE id = session_id;
  
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