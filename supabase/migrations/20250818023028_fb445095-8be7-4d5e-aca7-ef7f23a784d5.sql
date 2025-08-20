-- Add soft delete and room columns to sessions first
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS room_id uuid,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Create rooms table for canonical session lobbies
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add foreign key constraint after table exists
ALTER TABLE public.sessions 
ADD CONSTRAINT fk_sessions_room_id 
FOREIGN KEY (room_id) REFERENCES public.rooms(id);

-- Enable RLS on rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;