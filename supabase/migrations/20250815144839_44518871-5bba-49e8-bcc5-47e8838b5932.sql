-- Fix friend request "User not found" errors and implement multiplayer shared chat

-- Update can_view_profile function to check friendships table instead of friends table
CREATE OR REPLACE FUNCTION public.can_view_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    CASE 
      -- User can always view their own profile
      WHEN profile_user_id = auth.uid() THEN true
      -- Check privacy settings and friend status using friendships table
      ELSE EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = profile_user_id
        AND (
          -- Public visibility
          (p.privacy_settings->>'profile_visibility' = 'public')
          OR 
          -- Friends only visibility with confirmed friendship in friendships table
          (
            p.privacy_settings->>'profile_visibility' = 'friends'
            AND EXISTS (
              SELECT 1 FROM public.friendships f
              WHERE ((f.user_id = auth.uid() AND f.friend_id = profile_user_id) 
                     OR (f.user_id = profile_user_id AND f.friend_id = auth.uid()))
              AND f.status = 'accepted'
            )
          )
        )
      )
    END;
$$;

-- Create RPC for reliable multiplayer session joining
CREATE OR REPLACE FUNCTION public.join_multiplayer_session(session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  session_record RECORD;
  participant_count INTEGER;
  current_user_id uuid := auth.uid();
BEGIN
  -- Validate user is authenticated
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Get session details
  SELECT id, name, custom_prompt, messages, max_players, is_multiplayer, current_player_count
  INTO session_record
  FROM public.sessions 
  WHERE id = session_id AND is_multiplayer = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Multiplayer session not found');
  END IF;
  
  -- Check if user is already a participant
  IF EXISTS (
    SELECT 1 FROM public.session_participants 
    WHERE session_id = session_id AND user_id = current_user_id
  ) THEN
    -- Return session data for existing participant
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
  
  -- Add user as participant
  INSERT INTO public.session_participants (session_id, user_id, role, permissions)
  VALUES (session_id, current_user_id, 'player', '{"can_invite": false}'::jsonb);
  
  -- Update player count
  UPDATE public.sessions 
  SET current_player_count = current_player_count + 1,
      updated_at = now()
  WHERE id = session_id;
  
  -- Return session data
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
$$;

-- Create RPC for shared multiplayer chat messaging
CREATE OR REPLACE FUNCTION public.append_session_messages(
  session_id uuid,
  user_message jsonb,
  assistant_message jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path = 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_messages jsonb;
BEGIN
  -- Validate user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if user is a participant or session owner
  IF NOT (
    is_participant_safe(session_id, current_user_id) OR 
    is_session_owner_safe(session_id, current_user_id)
  ) THEN
    RAISE EXCEPTION 'Access denied: User is not a participant in this session';
  END IF;

  -- Get current messages
  SELECT messages INTO current_messages 
  FROM public.sessions 
  WHERE id = session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  -- Append both messages atomically
  UPDATE public.sessions
  SET 
    messages = COALESCE(current_messages, '[]'::jsonb) || jsonb_build_array(user_message, assistant_message),
    updated_at = now()
  WHERE id = session_id;

  RETURN true;
END;
$$;