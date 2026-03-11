-- Ensure auth schema exists and supabase_admin has full access (for GoTrue).
-- Without this, supabase/postgres image may create auth with restricted permissions.
CREATE SCHEMA IF NOT EXISTS auth;
ALTER SCHEMA auth OWNER TO supabase_admin;
GRANT ALL ON SCHEMA auth TO supabase_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_admin;
