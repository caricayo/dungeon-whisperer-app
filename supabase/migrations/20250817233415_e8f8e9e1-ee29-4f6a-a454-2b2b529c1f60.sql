-- Fix multiplayer session visibility, invites, and player count tracking

-- First, let's create a proper RPC function to accept session invites
CREATE OR REPLACE FUNCTION public.accept_session_invite(invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  invite_record RECORD;
  session_record RECORD;
  participant_count INTEGER;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Get invite details
  SELECT si.session_id, si.inviter_id, si.invitee_id, si.status
  INTO invite_record
  FROM public.session_invites si
  WHERE si.id = invite_id 
    AND si.invitee_id = current_user_id
    AND si.status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite not found or already processed');
  END IF;

  -- Get session details
  SELECT s.id, s.name, s.custom_prompt, s.messages, s.max_players, s.current_player_count
  INTO session_record
  FROM public.sessions s 
  WHERE s.id = invite_record.session_id AND s.is_multiplayer = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Multiplayer session not found');
  END IF;
  
  -- Check if session is full
  IF session_record.current_player_count >= COALESCE(session_record.max_players, 6) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session is full');
  END IF;
  
  -- Check if user is already a participant
  IF EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = invite_record.session_id AND sp.user_id = current_user_id
  ) THEN
    -- Update invite status anyway and return success
    UPDATE public.session_invites 
    SET status = 'accepted', updated_at = now()
    WHERE id = invite_id;
    
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
  
  -- Add user as participant
  INSERT INTO public.session_participants (session_id, user_id, role, permissions)
  VALUES (invite_record.session_id, current_user_id, 'player', '{"can_invite": false}'::jsonb);
  
  -- Update invite status
  UPDATE public.session_invites 
  SET status = 'accepted', updated_at = now()
  WHERE id = invite_id;
  
  -- Update player count will be handled by trigger
  
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

-- Create triggers to automatically maintain accurate player counts
CREATE OR REPLACE FUNCTION public.update_session_player_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Update the session's current_player_count based on actual participants
  IF TG_OP = 'DELETE' THEN
    UPDATE public.sessions 
    SET current_player_count = (
      SELECT COUNT(*) 
      FROM public.session_participants 
      WHERE session_id = OLD.session_id
    ),
    updated_at = now()
    WHERE id = OLD.session_id;
    
    RETURN OLD;
  ELSE
    UPDATE public.sessions 
    SET current_player_count = (
      SELECT COUNT(*) 
      FROM public.session_participants 
      WHERE session_id = NEW.session_id
    ),
    updated_at = now()
    WHERE id = NEW.session_id;
    
    RETURN NEW;
  END IF;
END;
$function$;

-- Create triggers on session_participants table
DROP TRIGGER IF EXISTS trigger_update_player_count_on_insert ON public.session_participants;
DROP TRIGGER IF EXISTS trigger_update_player_count_on_delete ON public.session_participants;

CREATE TRIGGER trigger_update_player_count_on_insert
  AFTER INSERT ON public.session_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_session_player_count();

CREATE TRIGGER trigger_update_player_count_on_delete
  AFTER DELETE ON public.session_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_session_player_count();

-- Update the discoverable sessions function to be more permissive for visibility
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

  -- Get or set the user's current world
  SELECT current_world INTO user_world 
  FROM public.profiles 
  WHERE id = current_user_id;
  
  -- Default to world 1 if no world is set, and update profile
  IF user_world IS NULL THEN
    user_world := 1;
    
    -- Ensure profile exists and set world
    INSERT INTO public.profiles (id, current_world, username) 
    VALUES (current_user_id, user_world, COALESCE(
      (SELECT raw_user_meta_data->>'username' FROM auth.users WHERE id = current_user_id),
      'user_' || substring(current_user_id::text from 1 for 8)
    ))
    ON CONFLICT (id) DO UPDATE SET current_world = user_world;
  END IF;
  
  -- Return discoverable sessions in the same world (including user's own sessions for visibility)
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.current_player_count,
    s.max_players,
    s.world,
    s.created_at,
    s.user_id as owner_id,
    COALESCE(p.username, 'Unknown') as owner_username
  FROM public.sessions s
  LEFT JOIN public.profiles p ON s.user_id = p.id
  WHERE s.is_multiplayer = true 
    AND s.current_player_count < COALESCE(s.max_players, 6)
    AND s.world = user_world
    -- Allow seeing own sessions too, just not joining them
  ORDER BY s.created_at DESC;
END;
$function$;