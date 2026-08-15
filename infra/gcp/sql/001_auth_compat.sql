-- Compatibilidade Supabase Auth helpers no Cloud SQL
-- Usado por RLS e por PostgREST (request.jwt.claims).
-- Claims Identity Platform: role, clinic_id, is_solo no topo do JWT;
-- também aceita app_metadata aninhado (transição).

CREATE SCHEMA IF NOT EXISTS auth;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- request.jwt.claim.* / request.jwt.claims via current_setting (PostgREST style)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claim.sub', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.role', true),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'role'),
    'anon'
  );
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

-- Unifica Identity Platform (claims no topo) com legado Supabase (app_metadata)
CREATE OR REPLACE FUNCTION auth.app_metadata()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN auth.jwt() ? 'app_metadata' THEN auth.jwt() -> 'app_metadata'
    ELSE jsonb_strip_nulls(jsonb_build_object(
      'role', auth.jwt() ->> 'role',
      'clinic_id', auth.jwt() ->> 'clinic_id',
      'is_solo', (auth.jwt() ->> 'is_solo')::boolean
    ))
  END;
$$;

COMMENT ON FUNCTION auth.uid() IS 'Compat Supabase/PostgREST — sub do JWT';
COMMENT ON FUNCTION auth.jwt() IS 'Compat Supabase — claims JSON completos';
COMMENT ON FUNCTION auth.app_metadata() IS 'Unifica claims Identity Platform e app_metadata legado';
