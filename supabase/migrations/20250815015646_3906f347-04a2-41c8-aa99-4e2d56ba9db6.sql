-- Fix infinite recursion in session_participants RLS policy
-- Remove the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view participants in their sessions" ON session_participants;

-- Create a simpler policy that avoids the circular reference
-- Users can only see their own participation records and records where they are DMs
CREATE POLICY "Users can view participants in their sessions" ON session_participants 
FOR SELECT USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM sessions s 
    WHERE s.id = session_participants.session_id 
    AND s.user_id = auth.uid()
  )
);