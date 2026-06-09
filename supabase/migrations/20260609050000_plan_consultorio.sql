-- ============================================================
-- THERAPY.AI — Add 'consultorio' plan type
-- Migration: 20260609050000_plan_consultorio.sql
-- Description: New plan for solo professionals (no clinic admin layer)
-- ============================================================

-- Add 'consultorio' to subscription_plan enum
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'consultorio' BEFORE 'starter';

-- Add column to clinics to flag solo-professional mode
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS is_solo_professional BOOLEAN NOT NULL DEFAULT false;

-- When is_solo_professional = true:
-- - The clinic admin IS the professional (same user)
-- - No separate "professionals" management screen
-- - Max 1 professional (the owner)
-- - Default max 50 patients for consultorio plan

-- Update clinic_settings defaults commentary:
-- consultorio: max_professionals=1, max_patients_per_professional=50
-- starter: max_professionals=3, max_patients_per_professional=30
-- professional: max_professionals=10, max_patients_per_professional=50
-- enterprise: max_professionals=unlimited, max_patients_per_professional=100
