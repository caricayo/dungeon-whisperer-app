-- Fix search path security issues for all functions

-- Fix audit function search path
CREATE OR REPLACE FUNCTION public.audit_user_settings_access()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Log access to sensitive user settings
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    auth.uid(),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'user_settings_create'
      WHEN TG_OP = 'UPDATE' THEN 'user_settings_update'
      WHEN TG_OP = 'DELETE' THEN 'user_settings_delete'
      ELSE 'user_settings_access'
    END,
    'user_settings',
    COALESCE(NEW.id, OLD.id),
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent',
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Fix get_safe_user_settings function search path
CREATE OR REPLACE FUNCTION public.get_safe_user_settings(target_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  id uuid,
  user_id uuid,
  custom_dnd_prompt text,
  elevenlabs_voice_id text,
  tts_speed numeric,
  tts_provider text,
  has_openai_key boolean,
  created_at timestamptz,
  updated_at timestamptz
) 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verify user can only access their own settings
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: Cannot access other users settings';
  END IF;

  -- Return user settings without exposing encrypted API key
  RETURN QUERY
  SELECT 
    us.id,
    us.user_id,
    us.custom_dnd_prompt,
    us.elevenlabs_voice_id,
    us.tts_speed,
    us.tts_provider,
    (us.openai_api_key_encrypted IS NOT NULL AND LENGTH(us.openai_api_key_encrypted) > 0) as has_openai_key,
    us.created_at,
    us.updated_at
  FROM public.user_settings us
  WHERE us.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- Fix update_user_settings_secure function search path
CREATE OR REPLACE FUNCTION public.update_user_settings_secure(
  p_custom_dnd_prompt text DEFAULT NULL,
  p_openai_api_key_encrypted text DEFAULT NULL,
  p_elevenlabs_voice_id text DEFAULT NULL,
  p_tts_speed numeric DEFAULT NULL,
  p_tts_provider text DEFAULT NULL
)
RETURNS boolean
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  settings_exists boolean;
BEGIN
  -- Validate user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate input parameters
  IF p_tts_speed IS NOT NULL AND (p_tts_speed < 0.1 OR p_tts_speed > 3.0) THEN
    RAISE EXCEPTION 'TTS speed must be between 0.1 and 3.0';
  END IF;

  IF p_tts_provider IS NOT NULL AND p_tts_provider NOT IN ('elevenlabs', 'openai') THEN
    RAISE EXCEPTION 'Invalid TTS provider';
  END IF;

  -- Check if settings exist
  SELECT EXISTS(
    SELECT 1 FROM public.user_settings 
    WHERE user_id = current_user_id
  ) INTO settings_exists;

  IF settings_exists THEN
    -- Update existing settings
    UPDATE public.user_settings 
    SET 
      custom_dnd_prompt = COALESCE(p_custom_dnd_prompt, custom_dnd_prompt),
      openai_api_key_encrypted = COALESCE(p_openai_api_key_encrypted, openai_api_key_encrypted),
      elevenlabs_voice_id = COALESCE(p_elevenlabs_voice_id, elevenlabs_voice_id),
      tts_speed = COALESCE(p_tts_speed, tts_speed),
      tts_provider = COALESCE(p_tts_provider, tts_provider),
      updated_at = now()
    WHERE user_id = current_user_id;
  ELSE
    -- Insert new settings
    INSERT INTO public.user_settings (
      user_id,
      custom_dnd_prompt,
      openai_api_key_encrypted,
      elevenlabs_voice_id,
      tts_speed,
      tts_provider
    ) VALUES (
      current_user_id,
      p_custom_dnd_prompt,
      p_openai_api_key_encrypted,
      p_elevenlabs_voice_id,
      COALESCE(p_tts_speed, 1.0),
      COALESCE(p_tts_provider, 'elevenlabs')
    );
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Fix delete_user_api_key function search path
CREATE OR REPLACE FUNCTION public.delete_user_api_key()
RETURNS boolean
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  -- Validate user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Clear the encrypted API key
  UPDATE public.user_settings 
  SET 
    openai_api_key_encrypted = NULL,
    updated_at = now()
  WHERE user_id = current_user_id;

  -- Log the key deletion
  INSERT INTO public.security_audit_log (
    user_id,
    action,
    resource_type,
    resource_id,
    created_at
  ) VALUES (
    current_user_id,
    'api_key_deleted',
    'user_settings',
    current_user_id,
    now()
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Fix rate limiting function search path
CREATE OR REPLACE FUNCTION public.check_user_settings_rate_limit()
RETURNS boolean
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  recent_operations integer;
BEGIN
  -- Allow if not authenticated (will be blocked by RLS anyway)
  IF current_user_id IS NULL THEN
    RETURN true;
  END IF;

  -- Count recent operations (last 5 minutes)
  SELECT COUNT(*)
  FROM public.security_audit_log
  WHERE user_id = current_user_id 
    AND resource_type = 'user_settings'
    AND action IN ('user_settings_create', 'user_settings_update')
    AND created_at > now() - interval '5 minutes'
  INTO recent_operations;

  -- Allow max 10 operations per 5 minutes
  IF recent_operations >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many user settings operations';
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;