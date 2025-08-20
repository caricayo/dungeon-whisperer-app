-- Fix infinite recursion in RLS policies by dropping problematic policies and recreating them correctly

-- Drop the existing problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view campaigns they own or are members of" ON public.campaigns;
DROP POLICY IF EXISTS "Users can view campaign memberships they are part of" ON public.campaign_members;

-- Create security definer functions to avoid recursion
CREATE OR REPLACE FUNCTION public.user_is_campaign_member(check_campaign_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM campaign_members 
    WHERE campaign_id = check_campaign_id 
    AND user_id = check_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_campaign_owner(check_campaign_id uuid, check_user_id uuid)  
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM campaigns 
    WHERE id = check_campaign_id 
    AND owner_id = check_user_id
  );
$$;

-- Recreate policies using security definer functions to prevent recursion
CREATE POLICY "Users can view campaigns they own or are members of"
ON public.campaigns
FOR SELECT
USING (
  auth.uid() = owner_id 
  OR user_is_campaign_member(id, auth.uid())
);

CREATE POLICY "Users can view campaign memberships they are part of"
ON public.campaign_members  
FOR SELECT
USING (
  auth.uid() = user_id 
  OR user_is_campaign_owner(campaign_id, auth.uid())
  OR user_is_campaign_member(campaign_id, auth.uid())
);

-- Drop conflicting user_settings policy that has qual: false
DROP POLICY IF EXISTS "user_settings_no_anonymous_access" ON public.user_settings;