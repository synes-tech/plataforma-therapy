-- ============================================================
-- Gestão de Identidade de Dependentes (Titular vs. Paciente) — 2.7
-- Agentes: DBA + Segurança + Backend
-- UUID permanece identificador canônico; CPF vira chave de busca.
-- ============================================================

-- Remover unicidade estrita profissional + CPF
DROP INDEX IF EXISTS public.idx_patients_professional_cpf_unique;

-- Renomear coluna legada
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'cpf'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'cpf_paciente'
  ) THEN
    ALTER TABLE public.patients RENAME COLUMN cpf TO cpf_paciente;
  END IF;
END$$;

-- Novas colunas de responsável
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS cpf_responsavel VARCHAR(11),
  ADD COLUMN IF NOT EXISTS nome_responsavel VARCHAR(200);

COMMENT ON COLUMN public.patients.cpf_paciente IS
  'CPF do paciente (11 dígitos). NULL quando dependente sem CPF próprio.';
COMMENT ON COLUMN public.patients.cpf_responsavel IS
  'CPF do responsável legal. Chave de busca; pode ser compartilhado entre irmãos.';
COMMENT ON COLUMN public.patients.nome_responsavel IS
  'Nome do responsável legal quando o paciente não possui CPF próprio.';

-- Índices de busca (sem UNIQUE)
DROP INDEX IF EXISTS public.idx_patients_cpf_search;

CREATE INDEX IF NOT EXISTS idx_patients_cpf_paciente_search
  ON public.patients (cpf_paciente)
  WHERE deleted_at IS NULL AND cpf_paciente IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_cpf_responsavel_search
  ON public.patients (cpf_responsavel)
  WHERE deleted_at IS NULL AND cpf_responsavel IS NOT NULL;
