-- ============================================================
-- Portal da Família — vínculo N:N + Combinados (agreements)
-- Agentes: DBA + Segurança
--
-- Decisão aprovada (Orquestrador): alinhar ao padrão do agente DBA e à spec
-- (user_id direto em patient_family_links), de forma ADITIVA e não-destrutiva.
-- family_members é mantido como perfil do responsável.
-- ============================================================

-- 1. user_id direto em patient_family_links (aditivo) -------------------------
ALTER TABLE public.patient_family_links
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill a partir do family_members existente
UPDATE public.patient_family_links pfl
SET user_id = fm.user_id
FROM public.family_members fm
WHERE pfl.family_member_id = fm.id
  AND pfl.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_pfl_user ON public.patient_family_links (user_id);
CREATE INDEX IF NOT EXISTS idx_pfl_user_patient ON public.patient_family_links (user_id, patient_id);

-- Policy de família por user_id direto (padrão do agente DBA 5.2) — aditiva
DROP POLICY IF EXISTS "patient_family_links_family_by_user" ON public.patient_family_links;
CREATE POLICY "patient_family_links_family_by_user"
  ON public.patient_family_links FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2. consume_invite agora grava user_id direto no vínculo --------------------
CREATE OR REPLACE FUNCTION public.consume_invite(
  p_code text, p_user_id uuid, p_name text, p_email text, p_phone text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_invite RECORD;
  v_family_member_id UUID;
  v_clinic_id UUID;
  v_patient_id UUID;
  v_max_family INT;
  v_current_family INT;
BEGIN
  SELECT * INTO v_invite FROM invites WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_NOT_FOUND'; END IF;
  IF v_invite.status = 'consumed' THEN RAISE EXCEPTION 'INVITE_CONSUMED'; END IF;
  IF v_invite.status = 'expired' OR v_invite.expires_at < now() THEN
    UPDATE invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'INVITE_EXPIRED';
  END IF;
  IF v_invite.status = 'revoked' THEN RAISE EXCEPTION 'INVITE_REVOKED'; END IF;

  v_clinic_id := v_invite.clinic_id;
  v_patient_id := v_invite.patient_id;

  SELECT cs.max_family_members_per_patient INTO v_max_family
  FROM clinic_settings cs WHERE cs.clinic_id = v_clinic_id;
  v_max_family := COALESCE(v_max_family, 2);

  SELECT COUNT(*) INTO v_current_family
  FROM patient_family_links pfl WHERE pfl.patient_id = v_patient_id;
  IF v_current_family >= v_max_family THEN RAISE EXCEPTION 'FAMILY_QUOTA_EXCEEDED'; END IF;

  -- Idempotência: se este usuário já está vinculado a este paciente, não duplica
  IF EXISTS (
    SELECT 1 FROM patient_family_links
    WHERE patient_id = v_patient_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'ALREADY_LINKED';
  END IF;

  INSERT INTO family_members (user_id, clinic_id, patient_id, name, email, phone, relationship, created_by)
  VALUES (p_user_id, v_clinic_id, v_patient_id, p_name, p_email, p_phone, v_invite.relationship, p_user_id)
  RETURNING id INTO v_family_member_id;

  INSERT INTO patient_family_links (patient_id, family_member_id, user_id, clinic_id, relationship, created_by)
  VALUES (v_patient_id, v_family_member_id, p_user_id, v_clinic_id, v_invite.relationship, p_user_id);

  UPDATE invites
  SET status = 'consumed', consumed_at = now(), consumed_by = p_user_id, times_used = times_used + 1
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'family_member_id', v_family_member_id,
    'patient_id', v_patient_id,
    'clinic_id', v_clinic_id,
    'relationship', v_invite.relationship
  );
END;
$function$;

-- 3. Tabela agreements (Combinados) ------------------------------------------
CREATE TABLE IF NOT EXISTS public.agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id),
  professional_id UUID NOT NULL REFERENCES public.professionals(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_agreements_patient_status
  ON public.agreements (patient_id, status) WHERE deleted_at IS NULL;

-- trigger de updated_at
CREATE OR REPLACE FUNCTION public.agreements_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agreements_updated_at ON public.agreements;
CREATE TRIGGER trg_agreements_updated_at
  BEFORE UPDATE ON public.agreements
  FOR EACH ROW EXECUTE FUNCTION public.agreements_set_updated_at();

-- 4. RLS de agreements -------------------------------------------------------
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agreements_master_access" ON public.agreements;
CREATE POLICY "agreements_master_access"
  ON public.agreements FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'role') = 'master');

-- Profissional dono do paciente: gestão total
DROP POLICY IF EXISTS "agreements_professional_own" ON public.agreements;
CREATE POLICY "agreements_professional_own"
  ON public.agreements FOR ALL TO authenticated
  USING (
    deleted_at IS NULL
    AND patient_id IN (
      SELECT pat.id FROM public.patients pat
      JOIN public.professionals prof ON pat.professional_id = prof.id
      WHERE prof.user_id = auth.uid() AND prof.deleted_at IS NULL AND pat.deleted_at IS NULL
    )
  );

-- Família vinculada: leitura
DROP POLICY IF EXISTS "agreements_family_view" ON public.agreements;
CREATE POLICY "agreements_family_view"
  ON public.agreements FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND patient_id IN (SELECT patient_id FROM public.patient_family_links WHERE user_id = auth.uid())
  );

-- Família vinculada: marcar como feito (UPDATE)
DROP POLICY IF EXISTS "agreements_family_update" ON public.agreements;
CREATE POLICY "agreements_family_update"
  ON public.agreements FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND patient_id IN (SELECT patient_id FROM public.patient_family_links WHERE user_id = auth.uid())
  )
  WITH CHECK (
    patient_id IN (SELECT patient_id FROM public.patient_family_links WHERE user_id = auth.uid())
  );

-- Least privilege: escrita estrutural só via service_role/Edge Functions
REVOKE INSERT, DELETE, TRUNCATE ON public.agreements FROM authenticated, anon;
