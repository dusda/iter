-- Profiles: link Supabase auth.users to app (organization_id, app_role, etc.)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  phone text,
  organization_id text REFERENCES public.organization(id) ON DELETE SET NULL,
  app_role text DEFAULT 'student',
  dashboard_permissions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);

-- Allow RLS later; for now rely on service role or anon + policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow authenticated users to update their own profile (limited columns if needed)
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow insert for own profile (e.g. on first login)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to read profiles in the same organization (for User list / staff views)
CREATE POLICY "Users can read same org profiles" ON public.profiles
  FOR SELECT USING (
    organization_id IS NOT NULL AND
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- Allow admin/fund_manager to update profiles in same org (for role changes)
CREATE POLICY "Admins can update same org profiles" ON public.profiles
  FOR UPDATE USING (
    organization_id IS NOT NULL AND
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND
    (SELECT app_role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'fund_manager')
  );
