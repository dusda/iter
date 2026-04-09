-- Super admins were not included in "Admins can update same org profiles", so PATCH
-- from the Users UI matched 0 rows → PostgREST PGRST116 / 406 Not Acceptable.
-- Also allow super_admins without a matching organization_id to read/update profiles
-- (RETURNING * after UPDATE still applies SELECT RLS).

CREATE POLICY "Super admins can read all profiles" ON public.profiles
  FOR SELECT
  USING (public.current_user_app_role() = 'super_admin');

CREATE POLICY "Super admins can update profiles" ON public.profiles
  FOR UPDATE
  USING (public.current_user_app_role() = 'super_admin')
  WITH CHECK (public.current_user_app_role() = 'super_admin');
