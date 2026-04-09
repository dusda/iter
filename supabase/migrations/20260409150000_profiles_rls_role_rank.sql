-- Org admins and fund managers may only UPDATE profiles for users at or below their own
-- app_role rank (same ordering as the app). Prevents changing role, permissions, or other
-- columns on higher-privilege users. Super admins remain governed by their separate policy.

CREATE OR REPLACE FUNCTION public.app_role_rank(p_role text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE COALESCE(NULLIF(trim(COALESCE(p_role, '')), ''), 'student')
    WHEN 'student' THEN 0
    WHEN 'reviewer' THEN 1
    WHEN 'advisor' THEN 2
    WHEN 'approver' THEN 3
    WHEN 'fund_manager' THEN 4
    WHEN 'admin' THEN 5
    WHEN 'super_admin' THEN 6
    ELSE 0
  END;
$$;

DROP POLICY IF EXISTS "Admins can update same org profiles" ON public.profiles;

CREATE POLICY "Admins can update same org profiles" ON public.profiles
  FOR UPDATE USING (
    organization_id IS NOT NULL
    AND organization_id = public.current_user_org_id()
    AND public.current_user_app_role() IN ('admin', 'fund_manager')
    AND public.app_role_rank(app_role) <= public.app_role_rank(public.current_user_app_role())
  );
