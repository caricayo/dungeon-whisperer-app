-- PHASE 1: ENTERPRISE SECURITY & RLS POLICIES
-- Fix all critical security vulnerabilities identified by the scanner

-- Enable comprehensive RLS policies for campaigns table
CREATE POLICY "Users can view campaigns they own or are members of" 
ON public.campaigns 
FOR SELECT 
USING (
  auth.uid() = owner_id OR 
  EXISTS (
    SELECT 1 FROM public.campaign_members 
    WHERE campaign_id = campaigns.id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own campaigns" 
ON public.campaigns 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Campaign owners can update their campaigns" 
ON public.campaigns 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Campaign owners can delete their campaigns" 
ON public.campaigns 
FOR DELETE 
USING (auth.uid() = owner_id);

-- Enable comprehensive RLS policies for campaign_members table
CREATE POLICY "Users can view campaign memberships they are part of" 
ON public.campaign_members 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.campaigns 
    WHERE id = campaign_members.campaign_id AND owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.campaign_members cm2 
    WHERE cm2.campaign_id = campaign_members.campaign_id AND cm2.user_id = auth.uid()
  )
);

CREATE POLICY "Campaign owners and GMs can add members" 
ON public.campaign_members 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns 
    WHERE id = campaign_members.campaign_id AND owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.campaign_members cm 
    WHERE cm.campaign_id = campaign_members.campaign_id 
    AND cm.user_id = auth.uid() 
    AND cm.role = 'gm'
  )
);

CREATE POLICY "Campaign owners and GMs can update member roles" 
ON public.campaign_members 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns 
    WHERE id = campaign_members.campaign_id AND owner_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.campaign_members cm 
    WHERE cm.campaign_id = campaign_members.campaign_id 
    AND cm.user_id = auth.uid() 
    AND cm.role = 'gm'
  )
);

CREATE POLICY "Campaign owners and members can leave campaigns" 
ON public.campaign_members 
FOR DELETE 
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.campaigns 
    WHERE id = campaign_members.campaign_id AND owner_id = auth.uid()
  )
);

-- Enable comprehensive RLS policies for characters table
CREATE POLICY "Users can view characters they own or are in same campaign" 
ON public.characters 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  (campaign_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.campaign_members 
    WHERE campaign_id = characters.campaign_id AND user_id = auth.uid()
  ))
);

CREATE POLICY "Users can create characters for campaigns they're in" 
ON public.characters 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND 
  (campaign_id IS NULL OR EXISTS (
    SELECT 1 FROM public.campaign_members 
    WHERE campaign_id = characters.campaign_id AND user_id = auth.uid()
  ))
);

CREATE POLICY "Users can update their own characters" 
ON public.characters 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own characters" 
ON public.characters 
FOR DELETE 
USING (auth.uid() = user_id);

-- Enable comprehensive RLS policies for encounters table
CREATE POLICY "Users can view encounters for campaigns they're in" 
ON public.encounters 
FOR SELECT 
USING (
  auth.uid() = created_by OR 
  EXISTS (
    SELECT 1 FROM public.campaign_members 
    WHERE campaign_id = encounters.campaign_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Campaign members can create encounters" 
ON public.encounters 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by AND 
  EXISTS (
    SELECT 1 FROM public.campaign_members 
    WHERE campaign_id = encounters.campaign_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Encounter creators and GMs can update encounters" 
ON public.encounters 
FOR UPDATE 
USING (
  auth.uid() = created_by OR 
  EXISTS (
    SELECT 1 FROM public.campaign_members cm 
    WHERE cm.campaign_id = encounters.campaign_id 
    AND cm.user_id = auth.uid() 
    AND cm.role = 'gm'
  )
);

CREATE POLICY "Encounter creators and GMs can delete encounters" 
ON public.encounters 
FOR DELETE 
USING (
  auth.uid() = created_by OR 
  EXISTS (
    SELECT 1 FROM public.campaign_members cm 
    WHERE cm.campaign_id = encounters.campaign_id 
    AND cm.user_id = auth.uid() 
    AND cm.role = 'gm'
  )
);

-- Enable comprehensive RLS policies for friendships table
CREATE POLICY "Users can view their own friendships" 
ON public.friendships 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friend requests" 
ON public.friendships 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friendships they're part of" 
ON public.friendships 
FOR UPDATE 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete friendships they're part of" 
ON public.friendships 
FOR DELETE 
USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Enable comprehensive RLS policies for session_state table
CREATE POLICY "Users can view session state for campaigns they're in" 
ON public.session_state 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.campaign_members 
    WHERE campaign_id = session_state.campaign_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Campaign members can create session state" 
ON public.session_state 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND 
  EXISTS (
    SELECT 1 FROM public.campaign_members 
    WHERE campaign_id = session_state.campaign_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own session state" 
ON public.session_state 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own session state" 
ON public.session_state 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create comprehensive helper functions for better performance
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