-- Fix security warning: Function Search Path Mutable
CREATE OR REPLACE FUNCTION public.update_session_player_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update the session's current_player_count based on actual participants
  IF TG_OP = 'DELETE' THEN
    UPDATE public.sessions 
    SET current_player_count = (
      SELECT COUNT(*) 
      FROM public.session_participants 
      WHERE session_id = OLD.session_id
    ),
    updated_at = now()
    WHERE id = OLD.session_id;
    
    RETURN OLD;
  ELSE
    UPDATE public.sessions 
    SET current_player_count = (
      SELECT COUNT(*) 
      FROM public.session_participants 
      WHERE session_id = NEW.session_id
    ),
    updated_at = now()
    WHERE id = NEW.session_id;
    
    RETURN NEW;
  END IF;
END;
$function$;