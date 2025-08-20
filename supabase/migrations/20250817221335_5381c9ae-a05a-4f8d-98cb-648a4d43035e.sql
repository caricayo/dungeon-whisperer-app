-- Update the discoverable sessions function to better handle world filtering
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
  -- Debug: log the current user
  RAISE NOTICE 'Current user ID: %', current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'No authenticated user, returning empty result';
    RETURN;
  END IF;

  -- Get the user's current world
  SELECT current_world INTO user_world 
  FROM public.profiles 
  WHERE id = current_user_id;
  
  -- Debug: log the user's world
  RAISE NOTICE 'User world: %', user_world;
  
  -- Default to world 1 if no world is set
  IF user_world IS NULL THEN
    user_world := 1;
    RAISE NOTICE 'No world set, defaulting to world 1';
  END IF;
  
  -- Return discoverable sessions in the user's world
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
  
  RAISE NOTICE 'Query completed';
END;
$function$;