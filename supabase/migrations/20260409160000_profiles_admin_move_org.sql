-- Org admins could UPDATE rows in their org, but WITH CHECK defaulted to the same
-- expression as USING, so the updated row still had to belong to the admin's org.
-- Allow org admins (not fund_manager) to set organization_id to any existing org.

DROP POLICY IF EXISTS "Admins can update same org profiles" ON public.profiles;

CREATE POLICY "Admins can update same org profiles" ON public.profiles
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND organization_id = public.current_user_org_id()
    AND public.current_user_app_role() IN ('admin', 'fund_manager')
    AND public.app_role_rank(app_role) <= public.app_role_rank(public.current_user_app_role())
  )
  WITH CHECK (
    public.current_user_app_role() IN ('admin', 'fund_manager')
    AND public.app_role_rank(app_role) <= public.app_role_rank(public.current_user_app_role())
    AND (
      (
        organization_id IS NOT NULL
        AND organization_id = public.current_user_org_id()
      )
      OR (
        public.current_user_app_role() = 'admin'
        AND organization_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.organization o WHERE o.id = organization_id
        )
      )
    )
  );
