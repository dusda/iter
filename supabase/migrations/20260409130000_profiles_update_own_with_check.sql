-- Ensure users can UPDATE their own profile row through RLS (e.g. status invited → active on login).
-- Some Postgres versions require an explicit WITH CHECK on UPDATE; without it, client updates may fail silently.

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
