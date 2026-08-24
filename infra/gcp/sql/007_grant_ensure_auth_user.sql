-- PostgREST staging usa PGRST_DB_ANON_ROLE=unithery_app (não service_role).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unithery_app') THEN
    GRANT EXECUTE ON FUNCTION public.ensure_auth_user(uuid, text) TO unithery_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.ensure_auth_user(uuid, text) TO service_role;
  END IF;
END$$;
