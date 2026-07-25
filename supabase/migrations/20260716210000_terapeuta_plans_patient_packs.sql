-- ============================================================
-- UNITHERY — Enum dos planos terapeuta (commit separado obrigatório no PG)
-- Migration: 20260716210000_terapeuta_plans_patient_packs.sql
-- ============================================================

ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'inicial';
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'intermediario';
