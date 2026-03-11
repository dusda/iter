-- Fix recursive RLS policies on public.profiles by using helper functions
-- that run as table owner (supabase_admin) and avoid querying public.profiles
-- inside policies directly (which caused infinite recursion).

-- Helper: current user's organization_id
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

-- Helper: current user's app_role
CREATE OR REPLACE FUNCTION public.current_user_app_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT app_role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

-- Replace recursive policies with versions that use the helper functions.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can read same org profiles'
  ) THEN
    DROP POLICY "Users can read same org profiles" ON public.profiles;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Admins can update same org profiles'
  ) THEN
    DROP POLICY "Admins can update same org profiles" ON public.profiles;
  END IF;
END $$;

-- New non-recursive policies
CREATE POLICY "Users can read same org profiles" ON public.profiles
  FOR SELECT USING (
    organization_id IS NOT NULL
    AND organization_id = public.current_user_org_id()
  );

CREATE POLICY "Admins can update same org profiles" ON public.profiles
  FOR UPDATE USING (
    organization_id IS NOT NULL
    AND organization_id = public.current_user_org_id()
    AND public.current_user_app_role() IN ('admin', 'fund_manager')
  );

