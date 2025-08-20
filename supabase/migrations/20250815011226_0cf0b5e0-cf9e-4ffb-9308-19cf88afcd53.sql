-- Drop existing potentially vulnerable policies
DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings; 
DROP POLICY IF EXISTS "Users can create their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete their own settings" ON public.user_settings;

-- Create more secure, explicit RLS policies that don't rely on functions
CREATE POLICY "user_settings_select_own_only" 
ON public.user_settings 
FOR SELECT 
USING (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "user_settings_insert_own_only" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "user_settings_update_own_only" 
ON public.user_settings 
FOR UPDATE 
USING (auth.uid() = user_id AND auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL);

CREATE POLICY "user_settings_delete_own_only" 
ON public.user_settings 
FOR DELETE 
USING (auth.uid() = user_id AND auth.uid() IS NOT NULL);

-- Ensure RLS is enabled (should already be, but double-check)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Add additional security: Make user_id non-nullable and add constraint
ALTER TABLE public.user_settings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_check 
CHECK (user_id IS NOT NULL AND user_id != '00000000-0000-0000-0000-000000000000'::uuid);