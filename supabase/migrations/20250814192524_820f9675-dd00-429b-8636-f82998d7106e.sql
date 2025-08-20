-- Add custom_dnd_prompt column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN custom_dnd_prompt text;