-- ============================================================
-- UNITHERY — Pré-visualização segura de convite (onboarding família)
-- Migration: 20260717100000_preview_invite_safety_check.sql
-- Description: RPC read-only para exibir nome do paciente antes do vínculo
-- ============================================================

CREATE OR REPLACE FUNCTION public.preview_invite(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_patient_name TEXT;
  v_max_family INT;
  v_current_family INT;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) <> 8 THEN
    RAISE EXCEPTION 'INVITE_INVALID_FORMAT';
  END IF;

  SELECT
    i.id,
    i.clinic_id,
    i.patient_id,
    i.status,
    i.relationship,
    i.expires_at,
    p.name AS patient_name
  INTO v_invite
  FROM invites i
  INNER JOIN patients p ON p.id = i.patient_id AND p.deleted_at IS NULL
  WHERE i.code = trim(p_code);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND';
  END IF;

  v_patient_name := v_invite.patient_name;

  IF v_invite.status = 'consumed' THEN
    RAISE EXCEPTION 'INVITE_CONSUMED';
  END IF;

  IF v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'INVITE_REVOKED';
  END IF;

  IF v_invite.status = 'expired' OR v_invite.expires_at < now() THEN
    UPDATE invites
    SET status = 'expired'
    WHERE id = v_invite.id AND status = 'pending';
    RAISE EXCEPTION 'INVITE_EXPIRED';
  END IF;

  SELECT cs.max_family_members_per_patient INTO v_max_family
  FROM clinic_settings cs
  WHERE cs.clinic_id = v_invite.clinic_id;

  v_max_family := COALESCE(v_max_family, 2);

  SELECT COUNT(*) INTO v_current_family
  FROM patient_family_links pfl
  WHERE pfl.patient_id = v_invite.patient_id;

  IF v_current_family >= v_max_family THEN
    RAISE EXCEPTION 'FAMILY_QUOTA_EXCEEDED';
  END IF;

  RETURN jsonb_build_object(
    'patient_name', v_patient_name,
    'relationship', v_invite.relationship
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_invite(TEXT) TO service_role;

COMMENT ON FUNCTION public.preview_invite(TEXT) IS
  'Pré-visualização read-only do paciente vinculado a um código de convite (onboarding família).';
