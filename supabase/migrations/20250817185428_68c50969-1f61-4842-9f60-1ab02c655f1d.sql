-- Add SET search_path to remaining functions for security

CREATE OR REPLACE FUNCTION public.append_session_messages(session_id uuid, user_message jsonb, assistant_message jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  current_messages jsonb;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    is_participant_safe(session_id, current_user_id) OR 
    is_session_owner_safe(session_id, current_user_id)
  ) THEN
    RAISE EXCEPTION 'Access denied: User is not a participant in this session';
  END IF;

  SELECT messages INTO current_messages 
  FROM public.sessions 
  WHERE id = session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  UPDATE public.sessions
  SET 
    messages = COALESCE(current_messages, '[]'::jsonb) || jsonb_build_array(user_message, assistant_message),
    updated_at = now()
  WHERE id = session_id;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.audit_user_settings_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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
$function$;

CREATE OR REPLACE FUNCTION public.can_access_invite_by_email(invite_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = invite_email
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_invite_to_session(session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants sp
    WHERE sp.session_id = $1 
    AND sp.user_id = auth.uid()
    AND (sp.role = 'dm' OR (sp.permissions->>'can_invite')::boolean = true)
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_multiplayer_participant(participant_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants sp1
    JOIN public.session_participants sp2 ON sp1.session_id = sp2.session_id
    WHERE sp1.user_id = auth.uid() 
    AND sp2.user_id = participant_user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.check_user_settings_rate_limit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  recent_operations integer;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN true;
  END IF;

  SELECT COUNT(*)
  FROM public.security_audit_log
  WHERE user_id = current_user_id 
    AND resource_type = 'user_settings'
    AND action IN ('user_settings_create', 'user_settings_update')
    AND created_at > now() - interval '5 minutes'
  INTO recent_operations;

  IF recent_operations >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many user settings operations';
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_user_api_key()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.user_settings 
  SET 
    openai_api_key_encrypted = NULL,
    updated_at = now()
  WHERE user_id = current_user_id;

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
$function$;

CREATE OR REPLACE FUNCTION public.get_safe_user_settings(target_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(id uuid, user_id uuid, custom_dnd_prompt text, elevenlabs_voice_id text, tts_speed numeric, tts_provider text, has_openai_key boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF target_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: Cannot access other users settings';
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.get_user_by_username(username_to_find text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id FROM public.profiles 
  WHERE LOWER(username) = LOWER(username_to_find)
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_campaign_role(check_campaign_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role::TEXT FROM public.campaign_members 
  WHERE campaign_id = check_campaign_id AND user_id = auth.uid()
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role_in_session(session_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role FROM public.session_participants 
  WHERE session_id = $1 AND user_id = auth.uid()
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_campaign_member(check_campaign_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_members 
    WHERE campaign_id = check_campaign_id 
    AND user_id = check_user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_campaign_owner(check_campaign_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns 
    WHERE id = check_campaign_id 
    AND owner_id = check_user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_session_dm(check_session_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants 
    WHERE session_id = check_session_id 
    AND user_id = check_user_id 
    AND role = 'dm'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_session_member(check_session_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants 
    WHERE session_id = check_session_id 
    AND user_id = check_user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_session_participant(session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.session_participants 
    WHERE session_id = $1 AND user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_settings_owner(settings_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() = settings_user_id;
$function$;

CREATE OR REPLACE FUNCTION public.is_user_session_participant(check_session_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM session_participants 
    WHERE session_id = check_session_id 
    AND user_id = check_user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_username_available(username_to_check text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(username) = LOWER(username_to_check)
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_username_taken(check_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(username) = LOWER(check_username)
  );
$function$;

CREATE OR REPLACE FUNCTION public.update_job_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.icon_generation_jobs 
  SET 
    completed_icons = (
      SELECT COUNT(*) 
      FROM public.icon_generation_results 
      WHERE job_id = NEW.job_id AND status = 'completed'
    ),
    updated_at = now(),
    completed_at = CASE 
      WHEN (SELECT COUNT(*) FROM public.icon_generation_results WHERE job_id = NEW.job_id AND status = 'completed') = 
           (SELECT total_icons FROM public.icon_generation_jobs WHERE id = NEW.job_id)
      THEN now()
      ELSE completed_at
    END,
    status = CASE 
      WHEN (SELECT COUNT(*) FROM public.icon_generation_results WHERE job_id = NEW.job_id AND status = 'completed') = 
           (SELECT total_icons FROM public.icon_generation_jobs WHERE id = NEW.job_id)
      THEN 'completed'
      WHEN (SELECT COUNT(*) FROM public.icon_generation_results WHERE job_id = NEW.job_id AND status = 'failed') > 0
      THEN 'processing'
      ELSE status
    END
  WHERE id = NEW.job_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_settings_secure(p_custom_dnd_prompt text DEFAULT NULL::text, p_openai_api_key_encrypted text DEFAULT NULL::text, p_elevenlabs_voice_id text DEFAULT NULL::text, p_tts_speed numeric DEFAULT NULL::numeric, p_tts_provider text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  settings_exists boolean;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_tts_speed IS NOT NULL AND (p_tts_speed < 0.1 OR p_tts_speed > 3.0) THEN
    RAISE EXCEPTION 'TTS speed must be between 0.1 and 3.0';
  END IF;

  IF p_tts_provider IS NOT NULL AND p_tts_provider NOT IN ('elevenlabs', 'openai') THEN
    RAISE EXCEPTION 'Invalid TTS provider';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.user_settings 
    WHERE user_id = current_user_id
  ) INTO settings_exists;

  IF settings_exists THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.user_is_campaign_member(check_campaign_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM campaign_members 
    WHERE campaign_id = check_campaign_id 
    AND user_id = check_user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.user_is_campaign_owner(check_campaign_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM campaigns 
    WHERE id = check_campaign_id 
    AND owner_id = check_user_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.validate_invite_token(token_to_check uuid)
RETURNS TABLE(invite_id uuid, campaign_id uuid, role campaign_role, invitee_username text, expires_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 
    id,
    campaign_id,
    role,
    invitee_username,
    expires_at
  FROM public.invites 
  WHERE invite_token = token_to_check 
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;
$function$;