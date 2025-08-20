-- Add world selection to profiles and sessions
ALTER TABLE public.profiles 
ADD COLUMN current_world SMALLINT NOT NULL DEFAULT 1 
CHECK (current_world >= 1 AND current_world <= 3);

ALTER TABLE public.sessions 
ADD COLUMN world SMALLINT NOT NULL DEFAULT 1 
CHECK (world >= 1 AND world <= 3);

-- Create index for performance on sessions by world and multiplayer status
CREATE INDEX idx_sessions_world_multiplayer ON public.sessions (world, is_multiplayer, current_player_count);

-- RPC to send friend request by user ID
CREATE OR REPLACE FUNCTION public.send_friend_request_by_user_id(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  target_profile RECORD;
  existing_friendship friendship_status;
  current_user_id uuid := auth.uid();
BEGIN
  -- Validate user is authenticated
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Check if target user exists and get their profile
  SELECT id, username INTO target_profile 
  FROM public.profiles 
  WHERE id = target_user_id;
  
  IF target_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF target_user_id = current_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot friend yourself');
  END IF;
  
  -- Check existing friendship
  SELECT status INTO existing_friendship
  FROM public.friendships 
  WHERE (user_id = current_user_id AND friend_id = target_user_id)
     OR (user_id = target_user_id AND friend_id = current_user_id);
  
  IF existing_friendship IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Friendship already exists');
  END IF;
  
  -- Create friend request
  INSERT INTO public.friendships (user_id, friend_id, status)
  VALUES (current_user_id, target_user_id, 'pending');
  
  RETURN jsonb_build_object('success', true, 'message', 'Friend request sent to ' || COALESCE(target_profile.username, 'user'));
END;
$$;

-- RPC to get discoverable sessions for current user's world
CREATE OR REPLACE FUNCTION public.get_discoverable_sessions_for_current_world()
RETURNS TABLE(
  id uuid,
  name text,
  current_player_count integer,
  max_players integer,
  world smallint,
  created_at timestamp with time zone,
  owner_id uuid,
  owner_username text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_world smallint;
  current_user_id uuid := auth.uid();
BEGIN
  -- Validate user is authenticated
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Get user's current world
  SELECT current_world INTO user_world 
  FROM public.profiles 
  WHERE id = current_user_id;
  
  IF user_world IS NULL THEN
    user_world := 1; -- Default to world 1 if not set
  END IF;
  
  -- Return discoverable sessions in the same world
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
    AND s.user_id != current_user_id  -- Exclude user's own sessions
    AND NOT EXISTS (
      -- Exclude sessions user is already participating in
      SELECT 1 FROM public.session_participants sp 
      WHERE sp.session_id = s.id AND sp.user_id = current_user_id
    )
  ORDER BY s.created_at DESC;
END;
$$;