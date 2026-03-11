-- Roles for PostgREST (run if using PostgREST; safe if roles already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- In this local setup, supabase_admin is the superuser / owner we use
-- for PostgREST and migrations, so grant the helper roles to it.
GRANT anon TO supabase_admin;
GRANT authenticated TO supabase_admin;
