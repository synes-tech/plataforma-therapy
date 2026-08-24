-- Espelho Identity Platform → auth.users (compat de FK).
-- Novos UIDs do Firebase não entram sozinhos na tabela migrada do GoTrue;
-- sem o stub, consume_invite quebra em family_members_created_by_fkey.

CREATE OR REPLACE FUNCTION public.ensure_auth_user(
  p_id uuid,
  p_email text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_USER_ID_REQUIRED';
  END IF;

  -- Só o id: email tem unique parcial e um retry/legado com o mesmo e-mail
  -- não pode impedir o stub necessário às FKs.
  INSERT INTO auth.users (id, created_at, updated_at, raw_user_meta_data)
  VALUES (
    p_id,
    now(),
    now(),
    CASE
      WHEN NULLIF(btrim(p_email), '') IS NULL THEN NULL
      ELSE jsonb_build_object('email', lower(btrim(p_email)))
    END
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_auth_user(uuid, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'unithery_app') THEN
    GRANT EXECUTE ON FUNCTION public.ensure_auth_user(uuid, text) TO unithery_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.ensure_auth_user(uuid, text) TO service_role;
  END IF;
END$$;

COMMENT ON FUNCTION public.ensure_auth_user(uuid, text) IS
  'Cria stub em auth.users para UID do Identity Platform. Usado por cadastros e consume_invite.';

-- consume_invite: garante o UID novo antes dos INSERTs e atribui created_by
-- ao profissional do convite (já existe em auth.users).
CREATE OR REPLACE FUNCTION public.consume_invite(
  p_code    text,
  p_user_id uuid,
  p_name    text,
  p_email   text,
  p_phone   text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite           RECORD;
  v_family_member_id uuid;
  v_clinic_id        uuid;
  v_patient_id       uuid;
  v_max_family       int;
  v_current_family   int;
  v_access_level     portal_access_level;
  v_created_by       uuid;
BEGIN
  SELECT * INTO v_invite FROM invites WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_NOT_FOUND'; END IF;
  IF v_invite.status = 'consumed' THEN RAISE EXCEPTION 'INVITE_CONSUMED'; END IF;
  IF v_invite.status = 'expired' OR v_invite.expires_at < now() THEN
    UPDATE invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'INVITE_EXPIRED';
  END IF;
  IF v_invite.status = 'revoked' THEN RAISE EXCEPTION 'INVITE_REVOKED'; END IF;

  v_clinic_id    := v_invite.clinic_id;
  v_patient_id   := v_invite.patient_id;
  v_access_level := COALESCE(v_invite.access_level, 'CAREGIVER');
  v_created_by   := COALESCE(v_invite.created_by, p_user_id);

  PERFORM public.ensure_auth_user(p_user_id, p_email);
  PERFORM public.ensure_auth_user(v_created_by);

  -- A cota existe para limitar cuidadores, não o próprio paciente.
  IF v_access_level = 'CAREGIVER' THEN
    SELECT cs.max_family_members_per_patient INTO v_max_family
      FROM clinic_settings cs WHERE cs.clinic_id = v_clinic_id;
    v_max_family := COALESCE(v_max_family, 2);

    SELECT COUNT(*) INTO v_current_family
      FROM patient_family_links pfl
     WHERE pfl.patient_id = v_patient_id
       AND pfl.revoked_at IS NULL
       AND pfl.access_level = 'CAREGIVER';

    IF v_current_family >= v_max_family THEN RAISE EXCEPTION 'FAMILY_QUOTA_EXCEEDED'; END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM patient_family_links
     WHERE patient_id = v_patient_id AND user_id = p_user_id AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ALREADY_LINKED';
  END IF;

  IF v_access_level = 'SELF' AND EXISTS (
    SELECT 1 FROM patient_family_links
     WHERE patient_id = v_patient_id AND access_level = 'SELF' AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SELF_ACCESS_ALREADY_EXISTS';
  END IF;

  INSERT INTO family_members (user_id, clinic_id, patient_id, name, email, phone, relationship, created_by)
  VALUES (p_user_id, v_clinic_id, v_patient_id, p_name, p_email, p_phone, v_invite.relationship, v_created_by)
  RETURNING id INTO v_family_member_id;

  INSERT INTO patient_family_links (
    patient_id, family_member_id, user_id, clinic_id, relationship, access_level,
    is_primary_contact, created_by
  )
  VALUES (
    v_patient_id, v_family_member_id, p_user_id, v_clinic_id, v_invite.relationship, v_access_level,
    NOT EXISTS (
      SELECT 1 FROM patient_family_links
       WHERE patient_id = v_patient_id AND is_primary_contact AND revoked_at IS NULL
    ),
    v_created_by
  );

  UPDATE invites
     SET status = 'consumed', consumed_at = now(), consumed_by = p_user_id,
         times_used = times_used + 1
   WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'family_member_id', v_family_member_id,
    'patient_id',       v_patient_id,
    'clinic_id',        v_clinic_id,
    'relationship',     v_invite.relationship,
    'access_level',     v_access_level
  );
END;
$$;
