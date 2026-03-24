-- Roles for PostgREST (run if using PostgREST; safe if roles already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- PostgREST must be able to SET ROLE to anon / authenticated. Official Supabase uses the
-- `authenticator` role; reserved `supabase_admin` cannot receive GRANT in managed/local stacks.
-- Minimal compose sometimes connects PostgREST as supabase_admin instead — grant that only when allowed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    GRANT anon, authenticated TO authenticator;
  END IF;
  BEGIN
    GRANT anon, authenticated TO supabase_admin;
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END $$;
