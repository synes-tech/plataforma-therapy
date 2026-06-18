-- ============================================================
-- Catálogo de planos — precificação e limites oficiais
-- Agentes: DBA + Segurança
-- ============================================================

CREATE TABLE IF NOT EXISTS planos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo_perfil TEXT NOT NULL CHECK (tipo_perfil IN ('autonomo', 'clinica')),
  preco_mensal_cents INT NOT NULL CHECK (preco_mensal_cents >= 0),
  limite_profissionais INT,
  limite_pacientes_por_prof INT,
  descricao_curta TEXT,
  destaque TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  recomendado BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_planos_updated
  BEFORE UPDATE ON planos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE planos ENABLE ROW LEVEL SECURITY;

-- Leitura pública (tela de registro antes do login)
DROP POLICY IF EXISTS "planos_public_read" ON planos;
CREATE POLICY "planos_public_read"
  ON planos FOR SELECT
  TO anon, authenticated
  USING (ativo = true);

GRANT SELECT ON planos TO anon, authenticated;

-- ============================================================
-- SEED — planos oficiais (id = subscription_plan slug)
-- ============================================================

INSERT INTO planos (
  id, nome, tipo_perfil, preco_mensal_cents,
  limite_profissionais, limite_pacientes_por_prof,
  descricao_curta, destaque, features, recomendado, sort_order
) VALUES
(
  'consultorio',
  'Consultório Autônomo',
  'autonomo',
  14700,
  1,
  50,
  'Para o profissional independente',
  '1 profissional · até 50 pacientes ativos',
  '[
    "Copiloto de IA avançado (streaming)",
    "Áudio com transcrição automática (STT)",
    "Resumo de prontuários e sugestões via IA",
    "Portal da Família (calendário e combinados)",
    "Relatórios em PDF com sua marca"
  ]'::jsonb,
  false,
  1
),
(
  'starter',
  'Clínica Starter',
  'clinica',
  39700,
  3,
  40,
  'Pequenos consultórios em expansão',
  'Até 3 profissionais · 40 pacientes/prof',
  '[
    "Todas as features do Consultório Autônomo",
    "Painel de Gestão de Clínica",
    "Prontuários sob guarda-chuva da clínica",
    "Métricas básicas de atendimento e uso de IA",
    "Suporte por e-mail"
  ]'::jsonb,
  false,
  2
),
(
  'professional',
  'Clínica Pro',
  'clinica',
  99700,
  10,
  60,
  'Clínicas estabelecidas com alto fluxo',
  'Até 10 profissionais · 60 pacientes/prof',
  '[
    "Tudo do Clínica Starter",
    "Relatórios avançados de performance",
    "Engajamento das famílias",
    "Suporte prioritário (SLA reduzido)",
    "Backup estendido do histórico de IA"
  ]'::jsonb,
  true,
  3
),
(
  'enterprise',
  'Enterprise',
  'clinica',
  0,
  NULL,
  NULL,
  'Grandes redes e hubs de saúde',
  'Limites e preço sob consulta',
  '[
    "Gerente de conta dedicado (CS)",
    "Onboarding para toda a equipe",
    "Profissionais e pacientes sob demanda",
    "API personalizada (integrações ERP)",
    "SLA e suporte premium"
  ]'::jsonb,
  false,
  4
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  tipo_perfil = EXCLUDED.tipo_perfil,
  preco_mensal_cents = EXCLUDED.preco_mensal_cents,
  limite_profissionais = EXCLUDED.limite_profissionais,
  limite_pacientes_por_prof = EXCLUDED.limite_pacientes_por_prof,
  descricao_curta = EXCLUDED.descricao_curta,
  destaque = EXCLUDED.destaque,
  features = EXCLUDED.features,
  recomendado = EXCLUDED.recomendado,
  sort_order = EXCLUDED.sort_order,
  ativo = EXCLUDED.ativo,
  updated_at = now();

-- Sincroniza clinic_settings a partir do plano da clínica
CREATE OR REPLACE FUNCTION public.sync_clinic_settings_from_plano(p_clinic_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_limite_prof INT;
  v_limite_pac INT;
BEGIN
  SELECT c.subscription_plan::text INTO v_plan
  FROM clinics c
  WHERE c.id = p_clinic_id AND c.deleted_at IS NULL;

  IF v_plan IS NULL THEN
    RETURN;
  END IF;

  SELECT limite_profissionais, limite_pacientes_por_prof
  INTO v_limite_prof, v_limite_pac
  FROM planos
  WHERE id = v_plan AND ativo = true;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE clinic_settings
  SET
    max_professionals = COALESCE(v_limite_prof, max_professionals),
    max_patients_per_professional = COALESCE(v_limite_pac, max_patients_per_professional),
    updated_at = now()
  WHERE clinic_id = p_clinic_id;

  IF NOT FOUND THEN
    INSERT INTO clinic_settings (
      clinic_id,
      max_professionals,
      max_patients_per_professional
    ) VALUES (
      p_clinic_id,
      COALESCE(v_limite_prof, 5),
      COALESCE(v_limite_pac, 30)
    );
  END IF;
END;
$$;

-- Backfill clínicas existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM clinics WHERE deleted_at IS NULL LOOP
    PERFORM public.sync_clinic_settings_from_plano(r.id);
  END LOOP;
END $$;
