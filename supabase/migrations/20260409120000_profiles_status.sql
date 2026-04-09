-- Account lifecycle for user management (invited vs active after first sign-in).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

COMMENT ON COLUMN public.profiles.status IS 'active, inactive, pending, or invited (invite sent, not yet signed in via login)';
