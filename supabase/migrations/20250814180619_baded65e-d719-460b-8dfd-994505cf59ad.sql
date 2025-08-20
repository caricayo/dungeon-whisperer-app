-- Add voice settings columns to user_settings table
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text,
ADD COLUMN IF NOT EXISTS tts_provider text DEFAULT 'elevenlabs';