-- Create RLS policies for rooms table
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

-- Create partial unique index for one active session per campaign
CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active_per_campaign 
ON public.sessions (campaign_id) 
WHERE deleted_at IS NULL AND status = 'active' AND campaign_id IS NOT NULL;

-- Update existing sessions RLS policies to include soft delete filter
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
    deleted_at IS NULL AND (
      auth.uid() = user_id OR 
      EXISTS (
        SELECT 1 FROM public.session_participants sp 
        WHERE sp.session_id = sessions.id AND sp.user_id = auth.uid() AND sp.role = 'dm'
      )
    )
  );

CREATE POLICY "Users can soft delete their own sessions" ON public.sessions
  FOR UPDATE USING (auth.uid() = user_id);