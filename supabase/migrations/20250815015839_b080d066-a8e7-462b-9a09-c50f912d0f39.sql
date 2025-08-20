-- Fix infinite recursion in sessions RLS policy
-- Remove the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view their own sessions or sessions they participate" ON sessions;

-- Create a simpler policy that avoids the circular reference
CREATE POLICY "Users can view their own sessions or sessions they participate" ON sessions 
FOR SELECT USING (
  auth.uid() = user_id OR 
  id IN (
    SELECT session_id FROM session_participants 
    WHERE user_id = auth.uid()
  )
);