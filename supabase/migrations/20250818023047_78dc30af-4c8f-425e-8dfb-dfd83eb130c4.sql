-- Create rooms table for canonical session lobbies
CREATE TABLE public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Add soft delete and room columns to sessions first
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS room_id uuid,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Add foreign key constraint after column exists
ALTER TABLE public.sessions 
ADD CONSTRAINT sessions_room_id_fkey 
FOREIGN KEY (room_id) REFERENCES public.rooms(id);

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