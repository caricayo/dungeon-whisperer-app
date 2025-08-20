-- Add columns if they don't exist (they might already be added)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'room_id') THEN
    ALTER TABLE public.sessions ADD COLUMN room_id uuid REFERENCES public.rooms(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'status') THEN
    ALTER TABLE public.sessions ADD COLUMN status text DEFAULT 'active';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'deleted_at') THEN
    ALTER TABLE public.sessions ADD COLUMN deleted_at timestamp with time zone;
  END IF;
END $$;

-- Create partial unique index if not exists
CREATE UNIQUE INDEX IF NOT EXISTS sessions_one_active_per_campaign 
ON public.sessions (campaign_id) 
WHERE deleted_at IS NULL AND status = 'active' AND campaign_id IS NOT NULL;

-- Recreate RLS policies for rooms (safe to recreate)
DROP POLICY IF EXISTS "Users can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Users can view rooms they created or participate in" ON public.rooms;  
DROP POLICY IF EXISTS "Room creators can update rooms" ON public.rooms;

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

-- Update sessions policies to include soft delete filter
DROP POLICY IF EXISTS "Users can view their own sessions or sessions they participate in" ON public.sessions;

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

-- Create display name function
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