-- Critical Security Fixes: Address email harvesting and profile privacy vulnerabilities

-- 1. Fix profiles RLS policy - replace overly permissive policy with friend-based access
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create more secure profile viewing policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can view friends' profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() != id AND 
  EXISTS (
    SELECT 1 FROM public.friends 
    WHERE ((user_id = auth.uid() AND friend_id = id) OR (user_id = id AND friend_id = auth.uid()))
    AND status = 'accepted'
  )
);

-- 2. Fix session_invites RLS policies to prevent email enumeration attacks
DROP POLICY IF EXISTS "Users can view invites they received (secure)" ON public.session_invites;
DROP POLICY IF EXISTS "Users can update invites they received (secure)" ON public.session_invites;

-- Create secure function to check if user can access invite by email
CREATE OR REPLACE FUNCTION public.can_access_invite_by_email(invite_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = invite_email
  );
$$;

-- Create more secure invite access policies
CREATE POLICY "Users can view invites sent to their email" 
ON public.session_invites 
FOR SELECT 
USING (public.can_access_invite_by_email(invitee_email));

CREATE POLICY "Users can update invites sent to their email" 
ON public.session_invites 
FOR UPDATE 
USING (public.can_access_invite_by_email(invitee_email));

-- 3. Add privacy controls to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS privacy_settings jsonb 
DEFAULT '{"profile_visibility": "friends", "show_online_status": true}'::jsonb;

-- 4. Create function to check profile visibility permissions
CREATE OR REPLACE FUNCTION public.can_view_profile(profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      -- User can always view their own profile
      WHEN profile_user_id = auth.uid() THEN true
      -- Check privacy settings and friend status
      ELSE EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = profile_user_id
        AND (
          -- Public visibility
          (p.privacy_settings->>'profile_visibility' = 'public')
          OR 
          -- Friends only visibility with confirmed friendship
          (
            p.privacy_settings->>'profile_visibility' = 'friends'
            AND EXISTS (
              SELECT 1 FROM public.friends f
              WHERE ((f.user_id = auth.uid() AND f.friend_id = profile_user_id) 
                     OR (f.user_id = profile_user_id AND f.friend_id = auth.uid()))
              AND f.status = 'accepted'
            )
          )
        )
      )
    END;
$$;

-- 5. Update profile policies to use the new privacy function
DROP POLICY IF EXISTS "Users can view friends' profiles" ON public.profiles;

CREATE POLICY "Users can view profiles based on privacy settings" 
ON public.profiles 
FOR SELECT 
USING (public.can_view_profile(id));