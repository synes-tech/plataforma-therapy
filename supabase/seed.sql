-- ============================================================
-- THERAPY.AI — Development Seed Data
-- Run with: supabase db reset (applies migrations + seed)
-- ============================================================

-- NOTE: In development, we create test users via Supabase Auth UI or CLI.
-- This seed focuses on the business data tables.
-- Auth users must be created first, then referenced here.

-- Placeholder: After creating auth users via Supabase dashboard or CLI,
-- update these UUIDs with the actual user IDs.

-- Example structure (uncomment and adjust after auth setup):

/*
-- Insert a test clinic
INSERT INTO clinics (id, name, document, email, phone, status, subscription_plan, created_by) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Clínica Exemplo TEA', '12.345.678/0001-90', 'contato@clinicaexemplo.com.br', '(11) 99999-0000', 'active', 'professional', '<MASTER_USER_UUID>');

-- Insert clinic settings
INSERT INTO clinic_settings (clinic_id, max_professionals, max_patients_per_professional, max_family_members_per_patient, max_ai_queries_per_month, max_audio_minutes_per_month) VALUES
  ('11111111-1111-1111-1111-111111111111', 10, 30, 2, 1000, 600);

-- Insert a test professional
INSERT INTO professionals (id, user_id, clinic_id, name, email, specialty, crp, status, created_by) VALUES
  ('22222222-2222-2222-2222-222222222222', '<PROFESSIONAL_USER_UUID>', '11111111-1111-1111-1111-111111111111', 'Dra. Maria Silva', 'maria@clinicaexemplo.com.br', 'Psicóloga', 'CRP 06/123456', 'active', '<MASTER_USER_UUID>');
*/
