-- Phase 1: Database Schema Fixes

-- Add missing status column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline'));

-- Fix sessions table RLS policy to prevent infinite recursion
DROP POLICY IF EXISTS "Users can view their own sessions or sessions they participate" ON public.sessions;
DROP POLICY IF EXISTS "Users can view their own sessions or sessions they participate " ON public.sessions;

CREATE POLICY "Users can view sessions they own or participate in" 
ON public.sessions 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR 
  auth.uid() IN (
    SELECT user_id FROM public.session_participants 
    WHERE session_id = sessions.id
  )
);

-- Ensure sessions table is added to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;