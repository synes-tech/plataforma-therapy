-- =====================================================================================
-- Unithery — Onboarding Universal: convite roteado e criação de paciente transacional
-- =====================================================================================
-- Contrato de execução: docs/plano-mestre-unithery-b2b-b2c.md (Prompt 3)
--
-- Duas entregas de banco que o backend precisa:
--
-- 1. CONVITE ROTEADO — `invites` passa a carregar o access_level. O mesmo código de
--    convite gera experiências diferentes: a mãe que relata sobre o filho (CAREGIVER) e
--    o adulto que relata sobre si (SELF).
--
-- 2. ATOMICIDADE REAL — hoje a criação de paciente é um INSERT seguido de compensação
--    por soft-delete: quando o contrato financeiro falha, sobra um paciente apagado no
--    banco. Com a taxonomia clínica e o convite entrando no mesmo fluxo, seriam três
--    escritas para compensar à mão. As Edge Functions falam com o Postgres por PostgREST
--    (HTTP), então não existe BEGIN/COMMIT do lado do Deno: a transação só pode viver
--    dentro de uma função plpgsql. É o que create_patient_tx faz.
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- 1. CONVITE COM NÍVEL DE ACESSO
-- =====================================================================================

ALTER TABLE invites
  ADD COLUMN IF NOT EXISTS access_level  portal_access_level NOT NULL DEFAULT 'CAREGIVER',
  ADD COLUMN IF NOT EXISTS invited_email text,
  ADD COLUMN IF NOT EXISTS invited_name  text,
  ADD COLUMN IF NOT EXISTS sent_at       timestamptz,
  ADD COLUMN IF NOT EXISTS send_error    text;

COMMENT ON COLUMN invites.access_level IS
  'Nível que o vínculo receberá ao consumir o convite. SELF só é emitido para paciente adulto.';
COMMENT ON COLUMN invites.invited_email IS
  'Destinatário do convite: o próprio paciente quando SELF, o responsável quando CAREGIVER.';
COMMENT ON COLUMN invites.sent_at IS
  'Quando o e-mail saiu. NULL com invited_email preenchido significa envio pendente ou falho — ver send_error.';

CREATE INDEX IF NOT EXISTS idx_invites_patient_pending
  ON invites (patient_id) WHERE status = 'pending';

-- =====================================================================================
-- 2. consume_invite v2 — propaga o access_level para o vínculo
-- =====================================================================================
-- Mudanças em relação à versão anterior:
--   - grava access_level em patient_family_links;
--   - a cota de familiares (clinic_settings.max_family_members_per_patient) passa a contar
--     apenas vínculos CAREGIVER: o acesso do próprio paciente não é "mais um familiar" e
--     não pode ser bloqueado por uma cota pensada para pais e cuidadores;
--   - vínculos revogados não ocupam vaga nem impedem um novo acesso.

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

  -- Um paciente só pode ter um acesso SELF ativo (índice único parcial garante isso,
  -- mas a checagem explícita devolve um erro de domínio em vez de violação de constraint).
  IF v_access_level = 'SELF' AND EXISTS (
    SELECT 1 FROM patient_family_links
     WHERE patient_id = v_patient_id AND access_level = 'SELF' AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SELF_ACCESS_ALREADY_EXISTS';
  END IF;

  INSERT INTO family_members (user_id, clinic_id, patient_id, name, email, phone, relationship, created_by)
  VALUES (p_user_id, v_clinic_id, v_patient_id, p_name, p_email, p_phone, v_invite.relationship, p_user_id)
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
    p_user_id
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

-- =====================================================================================
-- 3. create_patient_tx — criação atômica de paciente, condições e convite
-- =====================================================================================
-- Recebe um único jsonb para não precisar de uma assinatura com 40 parâmetros posicionais
-- que quebraria a cada campo novo de anamnese.
--
-- Escopo deliberado: o contrato financeiro NÃO entra aqui. Ele é calculado por
-- upsertFinancialContract em TypeScript (janelas de recorrência, pacotes, parcelas) e
-- reescrevê-lo em plpgsql seria uma reescrita de risco desproporcional. O que esta função
-- garante é que paciente + condições + convite nascem juntos ou não nascem. Se o contrato
-- falhar depois, o backend chama rollback_patient_creation e não sobra lixo.

CREATE OR REPLACE FUNCTION public.create_patient_tx(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id   uuid;
  v_clinic_id    uuid := (p_payload ->> 'clinic_id')::uuid;
  v_created_by   uuid := (p_payload ->> 'created_by')::uuid;
  v_invite       jsonb := p_payload -> 'invite';
  v_invite_id    uuid;
  v_invite_code  text;
  v_conditions   int := 0;
  v_attempt      int := 0;
BEGIN
  IF v_clinic_id IS NULL THEN
    RAISE EXCEPTION 'CLINIC_ID_REQUIRED';
  END IF;

  INSERT INTO patients (
    clinic_id, professional_id, created_by,
    name, birth_date, gender,
    cpf_paciente, cpf_responsavel, nome_responsavel,
    diagnoses, clinical_observations,
    profile_type, active_modules, autonomy_level,
    support_network, occupation_routine, mapped_triggers,
    nome_social, escolaridade_ocupacao, queixa_principal, medicamentos,
    acompanhamento_multi, composicao_familiar, responsaveis,
    objetivos_terapeuticos, hiperfocos_interesses, informacoes_adicionais,
    contact_scope, email_paciente, telefone_paciente, email_responsavel, telefone_responsavel,
    status, status_vinculo
  )
  VALUES (
    v_clinic_id,
    (p_payload ->> 'professional_id')::uuid,
    v_created_by,
    p_payload ->> 'name',
    (p_payload ->> 'birth_date')::date,
    COALESCE(p_payload ->> 'gender', 'not_informed'),
    p_payload ->> 'cpf_paciente',
    p_payload ->> 'cpf_responsavel',
    p_payload ->> 'nome_responsavel',
    COALESCE(p_payload -> 'diagnoses', '[]'::jsonb),
    p_payload ->> 'clinical_observations',
    (p_payload ->> 'profile_type')::patient_profile_type,
    COALESCE(
      (SELECT array_agg(value::clinical_module)
         FROM jsonb_array_elements_text(p_payload -> 'active_modules')),
      ARRAY['CLINICO_GERAL']::clinical_module[]
    ),
    (p_payload ->> 'autonomy_level')::patient_autonomy_level,
    p_payload ->> 'support_network',
    p_payload ->> 'occupation_routine',
    p_payload ->> 'mapped_triggers',
    p_payload ->> 'nome_social',
    p_payload ->> 'escolaridade_ocupacao',
    p_payload ->> 'queixa_principal',
    p_payload ->> 'medicamentos',
    COALESCE(p_payload -> 'acompanhamento_multi', '[]'::jsonb),
    p_payload ->> 'composicao_familiar',
    p_payload ->> 'responsaveis',
    p_payload ->> 'objetivos_terapeuticos',
    p_payload ->> 'hiperfocos_interesses',
    p_payload ->> 'informacoes_adicionais',
    p_payload ->> 'contact_scope',
    p_payload ->> 'email_paciente',
    p_payload ->> 'telefone_paciente',
    p_payload ->> 'email_responsavel',
    p_payload ->> 'telefone_responsavel',
    'active',
    'ativo'
  )
  RETURNING id INTO v_patient_id;

  -- Condições clínicas da taxonomia. O trigger de dual-write recalcula patients.diagnoses
  -- a partir daqui, então o array literal enviado acima é só o ponto de partida.
  IF jsonb_typeof(p_payload -> 'condition_ids') = 'array' THEN
    INSERT INTO patient_conditions (patient_id, clinic_id, taxonomy_id, raw_label, is_primary, created_by)
    SELECT
      v_patient_id,
      v_clinic_id,
      ct.id,
      COALESCE(ct.short_label, ct.label),
      c.ord = 1,
      v_created_by
    FROM jsonb_array_elements_text(p_payload -> 'condition_ids') WITH ORDINALITY AS c(value, ord)
    JOIN clinical_taxonomy ct ON ct.id = c.value::uuid AND ct.active
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_conditions = ROW_COUNT;
  END IF;

  -- Convite do portal, roteado pelo access_level definido no backend.
  IF v_invite IS NOT NULL AND jsonb_typeof(v_invite) = 'object' THEN
    WHILE v_invite_code IS NULL AND v_attempt < 5 LOOP
      v_attempt := v_attempt + 1;
      SELECT generate_invite_code() INTO v_invite_code;
      IF EXISTS (SELECT 1 FROM invites WHERE code = v_invite_code) THEN
        v_invite_code := NULL;
      END IF;
    END LOOP;

    IF v_invite_code IS NULL THEN
      RAISE EXCEPTION 'INVITE_CODE_GENERATION_FAILED';
    END IF;

    INSERT INTO invites (
      clinic_id, patient_id, professional_id, code, status, relationship,
      access_level, invited_email, invited_name, expires_at, created_by
    )
    VALUES (
      v_clinic_id,
      v_patient_id,
      (p_payload ->> 'professional_id')::uuid,
      v_invite_code,
      'pending',
      COALESCE(v_invite ->> 'relationship', 'responsável'),
      COALESCE((v_invite ->> 'access_level')::portal_access_level, 'CAREGIVER'),
      v_invite ->> 'email',
      v_invite ->> 'name',
      now() + make_interval(hours => COALESCE((v_invite ->> 'expires_in_hours')::int, 72)),
      v_created_by
    )
    RETURNING id INTO v_invite_id;
  END IF;

  RETURN jsonb_build_object(
    'patient_id',       v_patient_id,
    'conditions_count', v_conditions,
    'invite_id',        v_invite_id,
    'invite_code',      v_invite_code
  );
END;
$$;

COMMENT ON FUNCTION public.create_patient_tx(jsonb) IS
  'Cria paciente + condições clínicas + convite do portal em uma única transação. O contrato financeiro fica fora e é compensado por rollback_patient_creation.';

-- =====================================================================================
-- 4. rollback_patient_creation — desfaz de verdade, sem deixar lixo
-- =====================================================================================
-- Substitui o soft-delete de compensação. Um paciente que acabou de ser criado e cujo
-- contrato falhou não é um paciente arquivado: é um cadastro que nunca existiu. Só apaga
-- se não houver nada dependente, para nunca destruir histórico clínico por engano.

CREATE OR REPLACE FUNCTION public.rollback_patient_creation(p_patient_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_history boolean;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM therapist_schedule WHERE patient_id = p_patient_id)
    OR EXISTS (SELECT 1 FROM session_notes    WHERE patient_id = p_patient_id)
    OR EXISTS (SELECT 1 FROM diary_entries    WHERE patient_id = p_patient_id)
    OR EXISTS (SELECT 1 FROM patient_family_links WHERE patient_id = p_patient_id)
  INTO v_has_history;

  IF v_has_history THEN
    -- Algo já se apoiou neste paciente: arquiva em vez de apagar.
    UPDATE patients SET deleted_at = now() WHERE id = p_patient_id AND deleted_at IS NULL;
    RETURN false;
  END IF;

  DELETE FROM invites            WHERE patient_id = p_patient_id;
  DELETE FROM patient_conditions WHERE patient_id = p_patient_id;
  DELETE FROM patients           WHERE id = p_patient_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_patient_tx(jsonb)          TO unithery_app;
GRANT EXECUTE ON FUNCTION public.rollback_patient_creation(uuid)   TO unithery_app;

COMMIT;
