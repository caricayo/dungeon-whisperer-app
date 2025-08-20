-- Add soft delete and room columns to sessions (if not exists)
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.rooms(id),
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Create partial unique index for one active session per campaign
CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active_per_campaign 
ON public.sessions (campaign_id) 
WHERE deleted_at IS NULL AND status = 'active' AND campaign_id IS NOT NULL;

-- Create RLS policies for rooms
CREATE POLICY "Users can create rooms" ON public.rooms
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view rooms they created or participate in" ON public.rooms
  FOR SELECT USING (
    auth.uid() = created_by OR 
    EXISTS (
      SELECT 1 FROM public.sessions s 
      WHERE s.room_id = rooms.id 
      AND (s.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.session_participants sp 
        WHERE sp.session_id = s.id AND sp.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Room creators can update rooms" ON public.rooms
  FOR UPDATE USING (auth.uid() = created_by);

-- Update sessions RLS policies to include soft delete filter
DROP POLICY IF EXISTS "Users can create their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can view their own sessions or sessions they participate in" ON public.sessions;

CREATE POLICY "Users can create their own sessions" ON public.sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own sessions or sessions they participate in" ON public.sessions
  FOR SELECT USING (
    deleted_at IS NULL AND (
      auth.uid() = user_id OR 
      EXISTS (
        SELECT 1 FROM public.session_participants sp 
        WHERE sp.session_id = sessions.id AND sp.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own sessions" ON public.sessions
  FOR UPDATE USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.session_participants sp 
      WHERE sp.session_id = sessions.id AND sp.user_id = auth.uid() AND sp.role = 'dm'
    )
  );

-- Create function to resolve display name consistently
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

-- Create updated session join function
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
  members_result jsonb;
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
  
  -- Get last 30 messages
  SELECT COALESCE(
    jsonb_build_array(
      SELECT jsonb_array_elements(COALESCE(session_record.messages, '[]'::jsonb))
      ORDER BY (jsonb_array_elements(COALESCE(session_record.messages, '[]'::jsonb))->>'timestamp')::timestamp DESC 
      LIMIT 30
    ), 
    '[]'::jsonb
  ) INTO last_30_messages;
  
  -- Get all current members with display names
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'userId', sp.user_id,
        'role', sp.role,
        'displayName', public.get_display_name(p.*),
        'username', p.username,
        'avatarUrl', p.avatar_url,
        'joinedAt', sp.joined_at
      )
    ),
    '[]'::jsonb
  ) INTO members_result 
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
      'name', COALESCE(room_record.name, session_record.name || ' Room')
    ),
    'members', members_result,
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