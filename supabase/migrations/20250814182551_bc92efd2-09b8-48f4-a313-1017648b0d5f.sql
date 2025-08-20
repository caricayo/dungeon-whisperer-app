-- Add TTS speed setting to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN tts_speed DECIMAL(3,2) DEFAULT 1.0 CHECK (tts_speed >= 0.5 AND tts_speed <= 2.0);