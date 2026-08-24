-- =====================================================================================
-- Unithery — Fundação B2B + B2C (Portal Universal do Paciente + Acompanhante "Thery")
-- =====================================================================================
-- Épico: transformação da Unithery de nicho infantil (TEA/TDAH) para plataforma clínica
-- universal, mantendo o módulo de neurodesenvolvimento como diferencial especializado.
--
-- Contrato de execução: docs/plano-mestre-unithery-b2b-b2c.md
--
-- Princípios desta migration:
--   1. IDEMPOTENTE — pode rodar N vezes sem efeito colateral.
--   2. ADITIVA — nenhuma coluna/tabela é removida; nenhum comportamento atual é quebrado.
--   3. REVERSÍVEL EM DADO — todo dado transformado tem cópia da origem preservada.
--   4. SEGURA POR PADRÃO — o conteúdo do chat do paciente NÃO é legível pelo terapeuta
--      via RLS. O terapeuta enxerga alertas e resumos consentidos (ADR-06).
--
-- Divergências deliberadas do enunciado original (autorizadas no Prompt 1):
--   - patient_family_links NÃO é renomeada (12 vínculos vivos + 10 policies dependentes).
--     A semântica "portal" vem pela view patient_portal_links. (ADR-01)
--   - Não existe role 'portal_user'. O portal continua com role='family' e o que muda a
--     experiência é access_level ('CAREGIVER' | 'SELF'). (ADR-02)
--   - Módulo infantil chama-se NEURODESENVOLVIMENTO (não INFANTIL_DESENVOLVIMENTO), porque
--     TEA/TDAH não é exclusividade de criança. (ADR-04)
--   - profile_type legado é DERIVADO da data de nascimento real, não fixado em 'CHILD':
--     19 crianças, 6 adolescentes e 5 adultos já existem na base. (ADR-04)
--   - patient_copilot_messages NÃO aceita INSERT do cliente: inserir direto burlaria o
--     classificador de risco. Escrita é exclusiva do backend. (ADR-05)
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- 1. ENUMS
-- =====================================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_profile_type') THEN
    CREATE TYPE patient_profile_type AS ENUM ('CHILD', 'ADOLESCENT', 'ADULT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clinical_module') THEN
    -- CLINICO_GERAL: base universal, sempre ativa.
    -- NEURODESENVOLVIMENTO: módulo especializado TEA/TDAH (portal família, hiperfocos,
    --   registro sensorial, combinados, calendário de crises). Incluso em todos os planos.
    -- Demais: reservados, sem UI nesta fase.
    CREATE TYPE clinical_module AS ENUM (
      'CLINICO_GERAL',
      'NEURODESENVOLVIMENTO',
      'PERINATAL',
      'LUTO',
      'DEPENDENCIA_QUIMICA'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'portal_access_level') THEN
    CREATE TYPE portal_access_level AS ENUM ('CAREGIVER', 'SELF');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_autonomy_level') THEN
    -- SELF_MANAGED: cuida de si (adulto autônomo)
    -- SUPPORTED:    cuida de si com apoio de rede/família (ex.: TEA adulto com suporte)
    -- DEPENDENT:    depende integralmente de um responsável (criança / dependência severa)
    CREATE TYPE patient_autonomy_level AS ENUM ('SELF_MANAGED', 'SUPPORTED', 'DEPENDENT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clinical_risk_level') THEN
    CREATE TYPE clinical_risk_level AS ENUM ('LOW', 'MODERATE', 'SEVERE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clinical_alert_source') THEN
    CREATE TYPE clinical_alert_source AS ENUM ('COPILOT_B2C', 'DIARY', 'CHECKIN', 'MANUAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clinical_alert_status') THEN
    CREATE TYPE clinical_alert_status AS ENUM ('UNREAD', 'ACKNOWLEDGED', 'RESOLVED');
  END IF;
END
$$;

-- Valor reservado para o futuro; nenhuma claim 'patient' é emitida nesta fase (ADR-02).
-- Fora do bloco DO: ALTER TYPE ... ADD VALUE não pode ser executado de dentro de função.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'patient';

-- =====================================================================================
-- 2. ONTOLOGIA DO PACIENTE (tabela patients)
-- =====================================================================================

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS profile_type        patient_profile_type,
  ADD COLUMN IF NOT EXISTS active_modules      clinical_module[] NOT NULL DEFAULT ARRAY['CLINICO_GERAL']::clinical_module[],
  ADD COLUMN IF NOT EXISTS autonomy_level      patient_autonomy_level,
  ADD COLUMN IF NOT EXISTS support_network     text,
  ADD COLUMN IF NOT EXISTS occupation_routine  text,
  ADD COLUMN IF NOT EXISTS mapped_triggers     text,
  ADD COLUMN IF NOT EXISTS diagnoses_legacy    jsonb;

COMMENT ON COLUMN patients.profile_type IS
  'Faixa de perfil clínico. Derivado de birth_date quando não informado (ver trigger patients_derive_profile).';
COMMENT ON COLUMN patients.active_modules IS
  'Módulos clínicos ativos. CLINICO_GERAL é sempre incluído. NEURODESENVOLVIMENTO habilita o ecossistema TEA/TDAH.';
COMMENT ON COLUMN patients.autonomy_level IS
  'Define quem cuida do paciente: ele mesmo, ele com apoio, ou um responsável.';
COMMENT ON COLUMN patients.support_network IS
  'Equivalente adulto de composicao_familiar: rede de apoio (amigos, parceiro, colegas).';
COMMENT ON COLUMN patients.mapped_triggers IS
  'Gatilhos mapeados (equivalente adulto de hiperfocos_interesses).';
COMMENT ON COLUMN patients.diagnoses_legacy IS
  'Snapshot imutável de patients.diagnoses antes da normalização por clinical_taxonomy. Nunca alterar.';

-- Derivação determinística de perfil pela idade -------------------------------------
CREATE OR REPLACE FUNCTION public.derive_profile_type(p_birth_date date)
RETURNS patient_profile_type
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_birth_date IS NULL THEN 'ADULT'::patient_profile_type
    WHEN p_birth_date > (CURRENT_DATE - INTERVAL '13 years') THEN 'CHILD'::patient_profile_type
    WHEN p_birth_date > (CURRENT_DATE - INTERVAL '18 years') THEN 'ADOLESCENT'::patient_profile_type
    ELSE 'ADULT'::patient_profile_type
  END;
$$;

CREATE OR REPLACE FUNCTION public.default_autonomy_for_profile(p_profile patient_profile_type)
RETURNS patient_autonomy_level
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_profile
    WHEN 'CHILD'      THEN 'DEPENDENT'::patient_autonomy_level
    WHEN 'ADOLESCENT' THEN 'SUPPORTED'::patient_autonomy_level
    ELSE 'SELF_MANAGED'::patient_autonomy_level
  END;
$$;

-- Backfill legado: perfil real derivado da data de nascimento, NUNCA 'CHILD' para todos.
UPDATE patients
   SET profile_type = public.derive_profile_type(birth_date)
 WHERE profile_type IS NULL;

UPDATE patients
   SET autonomy_level = public.default_autonomy_for_profile(profile_type)
 WHERE autonomy_level IS NULL;

-- A base histórica é infantil/neurodivergente: preserva a capacidade de todos.
UPDATE patients
   SET active_modules = ARRAY['CLINICO_GERAL', 'NEURODESENVOLVIMENTO']::clinical_module[]
 WHERE NOT ('NEURODESENVOLVIMENTO' = ANY (active_modules))
   AND created_at < '2026-08-22'::timestamptz;

-- Snapshot da origem antes de qualquer normalização de diagnóstico.
UPDATE patients
   SET diagnoses_legacy = diagnoses
 WHERE diagnoses_legacy IS NULL;

-- Compatibilidade: create-patient atual (Prompt 3 ainda não executado) não envia
-- profile_type. O trigger garante coerência sem quebrar o endpoint em produção.
CREATE OR REPLACE FUNCTION public.patients_derive_profile()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.profile_type IS NULL THEN
    NEW.profile_type := public.derive_profile_type(NEW.birth_date);
  END IF;

  IF NEW.autonomy_level IS NULL THEN
    NEW.autonomy_level := public.default_autonomy_for_profile(NEW.profile_type);
  END IF;

  -- CLINICO_GERAL é invariante: todo paciente tem a base clínica ativa.
  IF NEW.active_modules IS NULL OR array_length(NEW.active_modules, 1) IS NULL THEN
    NEW.active_modules := ARRAY['CLINICO_GERAL']::clinical_module[];
  ELSIF NOT ('CLINICO_GERAL' = ANY (NEW.active_modules)) THEN
    NEW.active_modules := ARRAY['CLINICO_GERAL']::clinical_module[] || NEW.active_modules;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patients_derive_profile ON patients;
CREATE TRIGGER trg_patients_derive_profile
  BEFORE INSERT OR UPDATE OF birth_date, profile_type, active_modules, autonomy_level
  ON patients
  FOR EACH ROW EXECUTE FUNCTION public.patients_derive_profile();

ALTER TABLE patients ALTER COLUMN profile_type   SET NOT NULL;
ALTER TABLE patients ALTER COLUMN autonomy_level SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_profile_type ON patients (profile_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_active_modules ON patients USING GIN (active_modules);

-- =====================================================================================
-- 3. TAXONOMIA CLÍNICA (substitui o array livre de strings)
-- =====================================================================================
-- Motivação factual: a base tem "TEA - Nível 1", "TEA - NIVEL 1" e "TEA Nivel 1" como três
-- entradas distintas, "TPAC" separado de seu nome por extenso, e um registro com o valor
-- "a". Como o system prompt do copiloto injeta diagnoses literalmente, isso envenena o RAG.

CREATE TABLE IF NOT EXISTS clinical_taxonomy (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,
  label             text NOT NULL,
  short_label       text,
  category          text NOT NULL,
  synonyms          text[] NOT NULL DEFAULT '{}',
  icd11             text,
  dsm5              text,
  typical_profiles  patient_profile_type[] NOT NULL DEFAULT ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[],
  suggested_modules clinical_module[] NOT NULL DEFAULT ARRAY['CLINICO_GERAL']::clinical_module[],
  is_diagnosis      boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 100,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE clinical_taxonomy IS
  'Catálogo curado de condições e focos clínicos. is_diagnosis=false marca demandas que não são diagnóstico (luto, burnout, conflito conjugal).';

CREATE INDEX IF NOT EXISTS idx_clinical_taxonomy_category ON clinical_taxonomy (category) WHERE active;
CREATE INDEX IF NOT EXISTS idx_clinical_taxonomy_synonyms ON clinical_taxonomy USING GIN (synonyms);

CREATE TABLE IF NOT EXISTS patient_conditions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id     uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  taxonomy_id   uuid REFERENCES clinical_taxonomy(id) ON DELETE RESTRICT,
  raw_label     text NOT NULL,
  is_primary    boolean NOT NULL DEFAULT false,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'in_investigation', 'resolved', 'ruled_out')),
  needs_review  boolean NOT NULL DEFAULT false,
  noted_at      date NOT NULL DEFAULT CURRENT_DATE,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid
);

COMMENT ON COLUMN patient_conditions.raw_label IS
  'Rótulo original digitado pelo terapeuta. Preservado sempre, inclusive quando há match na taxonomia.';
COMMENT ON COLUMN patient_conditions.needs_review IS
  'true quando o texto legado não casou com a taxonomia. Exige curadoria humana, nunca descarte automático.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_conditions_taxonomy
  ON patient_conditions (patient_id, taxonomy_id) WHERE taxonomy_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_conditions_raw
  ON patient_conditions (patient_id, lower(raw_label)) WHERE taxonomy_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_conditions_patient ON patient_conditions (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_conditions_clinic ON patient_conditions (clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_conditions_review ON patient_conditions (clinic_id) WHERE needs_review;

-- Normalização para matching (sem acento, sem pontuação, caixa alta, espaço colapsado).
CREATE OR REPLACE FUNCTION public.normalize_clinical_label(p_label text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(
      upper(
        translate(
          coalesce(p_label, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
          'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
        )
      ),
      '[^A-Z0-9]+', ' ', 'g'
    ),
    ' '
  );
$$;

CREATE OR REPLACE FUNCTION public.match_clinical_taxonomy(p_label text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT ct.id
    FROM clinical_taxonomy ct
   WHERE ct.active
     AND (
       public.normalize_clinical_label(ct.code)  = public.normalize_clinical_label(p_label)
       OR public.normalize_clinical_label(ct.label) = public.normalize_clinical_label(p_label)
       OR EXISTS (
            SELECT 1 FROM unnest(ct.synonyms) s
             WHERE public.normalize_clinical_label(s) = public.normalize_clinical_label(p_label)
          )
     )
   ORDER BY ct.sort_order
   LIMIT 1;
$$;

-- ---------------------------------------------------------------------------------
-- Seed do catálogo — psicologia clínica geral + neurodesenvolvimento + demandas de vida
-- ---------------------------------------------------------------------------------
INSERT INTO clinical_taxonomy (code, label, short_label, category, synonyms, dsm5, typical_profiles, suggested_modules, is_diagnosis, sort_order)
VALUES
  -- Neurodesenvolvimento -----------------------------------------------------------
  ('TEA','Transtorno do Espectro Autista','TEA','NEURODESENVOLVIMENTO',
    ARRAY['autismo','espectro autista','asd','transtorno do espectro autista','tea'],'299.00',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 10),
  ('TEA_N1','TEA nível 1 (exige apoio)','TEA nível 1','NEURODESENVOLVIMENTO',
    ARRAY['tea nivel 1','tea - nivel 1','tea n1','autismo nivel 1','tea leve','tea grau 1'],'299.00',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 11),
  ('TEA_N2','TEA nível 2 (apoio substancial)','TEA nível 2','NEURODESENVOLVIMENTO',
    ARRAY['tea nivel 2','tea - nivel 2','tea n2','autismo nivel 2','tea grau 2'],'299.00',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 12),
  ('TEA_N3','TEA nível 3 (apoio muito substancial)','TEA nível 3','NEURODESENVOLVIMENTO',
    ARRAY['tea nivel 3','tea - nivel 3','tea n3','autismo nivel 3','tea grau 3'],'299.00',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 13),
  ('TDAH','Transtorno de Déficit de Atenção e Hiperatividade','TDAH','NEURODESENVOLVIMENTO',
    ARRAY['tdah','tda','tda h','deficit de atencao','transtorno de deficit de atencao','adhd','hiperatividade'],'314.01',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 14),
  ('TDL','Transtorno do Desenvolvimento da Linguagem','Atraso de linguagem','NEURODESENVOLVIMENTO',
    ARRAY['atraso na fala','atraso de fala','atraso de linguagem','disturbio de linguagem','tdl'],'315.39',
    ARRAY['CHILD','ADOLESCENT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 15),
  ('TPAC','Transtorno do Processamento Auditivo Central','TPAC','NEURODESENVOLVIMENTO',
    ARRAY['tpac','transtorno do processamento auditivo central','processamento auditivo','dpac'],NULL,
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 16),
  ('TRANSTORNO_APRENDIZAGEM','Transtorno Específico da Aprendizagem','Transtorno de aprendizagem','NEURODESENVOLVIMENTO',
    ARRAY['transtorno de aprendizagem','deficit de aprendizagem','dificuldade de aprendizagem','transtorno especifico da aprendizagem'],'315.00',
    ARRAY['CHILD','ADOLESCENT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 17),
  ('DISLEXIA','Dislexia','Dislexia','NEURODESENVOLVIMENTO', ARRAY['dislexia'],'315.00',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 18),
  ('DISCALCULIA','Discalculia','Discalculia','NEURODESENVOLVIMENTO', ARRAY['discalculia'],'315.1',
    ARRAY['CHILD','ADOLESCENT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 19),
  ('ATRASO_DESENVOLVIMENTO','Atraso Global do Desenvolvimento','Atraso do desenvolvimento','NEURODESENVOLVIMENTO',
    ARRAY['atraso no desenvolvimento','atraso global do desenvolvimento','atraso do desenvolvimento','agd'],'315.8',
    ARRAY['CHILD']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 20),
  ('DEFICIENCIA_INTELECTUAL','Deficiência Intelectual','DI','NEURODESENVOLVIMENTO',
    ARRAY['deficiencia intelectual','di','retardo mental'],'319',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 21),
  ('TOURETTE','Transtorno de Tourette e tiques','Tiques','NEURODESENVOLVIMENTO',
    ARRAY['tourette','tiques','transtorno de tiques'],'307.23',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 22),
  ('ALTAS_HABILIDADES','Altas Habilidades / Superdotação','AH/SD','NEURODESENVOLVIMENTO',
    ARRAY['altas habilidades','superdotacao','ahsd','superdotado'],NULL,
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], false, 23),

  -- Ansiedade ----------------------------------------------------------------------
  -- Os sinônimos incluem grafias erradas encontradas na base real: normalizar sem perder o registro.
  ('TAG','Transtorno de Ansiedade Generalizada','TAG','ANSIEDADE',
    ARRAY['tag','ansiedade generalizada','transtorno de ansiedade generalizada','ansiedade generalzida',
          'ansiedade generalziada','ansiedade generalizado','tag ansiedade'],'300.02',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 30),
  ('ANSIEDADE_NE','Quadro ansioso não especificado','Ansiedade','ANSIEDADE',
    ARRAY['ansiedade','transtorno de ansiedade','quadro ansioso','ansiedade nao especificada'],'300.00',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 31),
  ('PANICO','Transtorno de Pânico','Pânico','ANSIEDADE',
    ARRAY['panico','transtorno de panico','sindrome do panico','crise de panico'],'300.01',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 32),
  ('FOBIA_SOCIAL','Transtorno de Ansiedade Social','Fobia social','ANSIEDADE',
    ARRAY['fobia social','ansiedade social','timidez patologica'],'300.23',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 33),
  ('FOBIA_ESPECIFICA','Fobia Específica','Fobia','ANSIEDADE',
    ARRAY['fobia','fobia especifica','medo especifico'],'300.29',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 34),
  ('AGORAFOBIA','Agorafobia','Agorafobia','ANSIEDADE', ARRAY['agorafobia'],'300.22',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 35),
  ('ANSIEDADE_SEPARACAO','Transtorno de Ansiedade de Separação','Ansiedade de separação','ANSIEDADE',
    ARRAY['ansiedade de separacao'],'309.21',
    ARRAY['CHILD','ADOLESCENT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 36),
  ('MUTISMO_SELETIVO','Mutismo Seletivo','Mutismo seletivo','ANSIEDADE',
    ARRAY['mutismo seletivo','mutismo'],'313.23',
    ARRAY['CHILD']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 37),

  -- Humor --------------------------------------------------------------------------
  ('DEPRESSAO','Transtorno Depressivo Maior','Depressão','HUMOR',
    ARRAY['depressao','tdm','transtorno depressivo','episodio depressivo','depressivo maior'],'296.20',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 40),
  ('DISTIMIA','Transtorno Depressivo Persistente (Distimia)','Distimia','HUMOR',
    ARRAY['distimia','depressao persistente'],'300.4',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 41),
  ('BIPOLAR','Transtorno Bipolar','Bipolar','HUMOR',
    ARRAY['bipolar','tab','transtorno bipolar','transtorno afetivo bipolar'],'296.80',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 42),
  ('TDPM','Transtorno Disfórico Pré-Menstrual','TDPM','HUMOR',
    ARRAY['tdpm','disforico pre menstrual','tpm severa'],'625.4',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 43),
  ('DESREGULACAO_HUMOR','Transtorno Disruptivo da Desregulação do Humor','Desregulação do humor','HUMOR',
    ARRAY['desregulacao do humor','tddh'],'296.99',
    ARRAY['CHILD','ADOLESCENT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 44),

  -- TOC e relacionados --------------------------------------------------------------
  ('TOC','Transtorno Obsessivo-Compulsivo','TOC','TOC_RELACIONADOS',
    ARRAY['toc','obsessivo compulsivo','transtorno obsessivo compulsivo'],'300.3',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 50),
  ('TRICOTILOMANIA','Tricotilomania','Tricotilomania','TOC_RELACIONADOS',
    ARRAY['tricotilomania','arrancar cabelo'],'312.39',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 51),
  ('ESCORIACAO','Transtorno de Escoriação (skin picking)','Escoriação','TOC_RELACIONADOS',
    ARRAY['escoriacao','skin picking','dermatilomania'],'698.4',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 52),
  ('DISMORFICO','Transtorno Dismórfico Corporal','Dismórfico corporal','TOC_RELACIONADOS',
    ARRAY['dismorfico','transtorno dismorfico corporal','dismorfia'],'300.7',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 53),
  ('ACUMULACAO','Transtorno de Acumulação','Acumulação','TOC_RELACIONADOS',
    ARRAY['acumulacao','hoarding','acumulador'],'300.3',
    ARRAY['ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 54),

  -- Trauma e estresse ---------------------------------------------------------------
  ('TEPT','Transtorno de Estresse Pós-Traumático','TEPT','TRAUMA',
    ARRAY['tept','estresse pos traumatico','ptsd','pos traumatico'],'309.81',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 60),
  ('ESTRESSE_AGUDO','Transtorno de Estresse Agudo','Estresse agudo','TRAUMA',
    ARRAY['estresse agudo'],'308.3',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 61),
  ('TRANSTORNO_ADAPTACAO','Transtorno de Adaptação','Adaptação','TRAUMA',
    ARRAY['transtorno de adaptacao','adaptativo'],'309.9',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 62),
  ('VIOLENCIA_ABUSO','Vivência de violência ou abuso','Violência/abuso','TRAUMA',
    ARRAY['abuso','violencia','violencia domestica','abuso sexual','bullying'],NULL,
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], false, 63),

  -- Alimentares ---------------------------------------------------------------------
  ('ANOREXIA','Anorexia Nervosa','Anorexia','ALIMENTARES',
    ARRAY['anorexia','anorexia nervosa'],'307.1',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 70),
  ('BULIMIA','Bulimia Nervosa','Bulimia','ALIMENTARES',
    ARRAY['bulimia','bulimia nervosa'],'307.51',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 71),
  ('COMPULSAO_ALIMENTAR','Transtorno de Compulsão Alimentar','Compulsão alimentar','ALIMENTARES',
    ARRAY['compulsao alimentar','tcap','binge eating'],'307.51',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 72),
  ('ARFID','Transtorno Alimentar Restritivo/Evitativo (ARFID)','Seletividade alimentar','ALIMENTARES',
    ARRAY['arfid','seletividade alimentar','seletividade','restricao alimentar','alimentacao seletiva'],'307.59',
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 73),

  -- Sono ------------------------------------------------------------------------------
  ('INSONIA','Insônia','Insônia','SONO', ARRAY['insonia','transtorno de insonia'],'780.52',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 80),
  ('DISTURBIO_SONO_INFANTIL','Distúrbio do sono na infância','Sono infantil','SONO',
    ARRAY['disturbio do sono','pesadelos','terror noturno','sono infantil'],NULL,
    ARRAY['CHILD']::patient_profile_type[], ARRAY['CLINICO_GERAL','NEURODESENVOLVIMENTO']::clinical_module[], true, 81),

  -- Personalidade ---------------------------------------------------------------------
  ('BORDERLINE','Transtorno de Personalidade Borderline','Borderline','PERSONALIDADE',
    ARRAY['borderline','tpb','personalidade borderline'],'301.83',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 90),
  ('PERSONALIDADE_EVITATIVA','Transtorno de Personalidade Evitativa','Evitativa','PERSONALIDADE',
    ARRAY['personalidade evitativa','esquiva'],'301.82',
    ARRAY['ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 91),
  ('PERSONALIDADE_OBSESSIVA','Transtorno de Personalidade Obsessivo-Compulsiva','TPOC','PERSONALIDADE',
    ARRAY['tpoc','personalidade obsessiva'],'301.4',
    ARRAY['ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 92),
  ('PERSONALIDADE_NARCISISTA','Transtorno de Personalidade Narcisista','Narcisista','PERSONALIDADE',
    ARRAY['narcisista','personalidade narcisista'],'301.81',
    ARRAY['ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 93),

  -- Dependências -----------------------------------------------------------------------
  ('DEPENDENCIA_ALCOOL','Transtorno por Uso de Álcool','Álcool','DEPENDENCIA',
    ARRAY['alcoolismo','dependencia de alcool','uso de alcool'],'303.90',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','DEPENDENCIA_QUIMICA']::clinical_module[], true, 100),
  ('DEPENDENCIA_SUBSTANCIAS','Transtorno por Uso de Substâncias','Substâncias','DEPENDENCIA',
    ARRAY['dependencia quimica','uso de substancias','drogadicao','toxicodependencia'],'304.90',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','DEPENDENCIA_QUIMICA']::clinical_module[], true, 101),
  ('JOGO_PATOLOGICO','Jogo Patológico','Jogo','DEPENDENCIA',
    ARRAY['jogo patologico','ludopatia','apostas','bet'],'312.31',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','DEPENDENCIA_QUIMICA']::clinical_module[], true, 102),
  ('USO_PROBLEMATICO_TECNOLOGIA','Uso problemático de telas e internet','Telas','DEPENDENCIA',
    ARRAY['vicio em telas','uso de telas','vicio em internet','dependencia de celular'],NULL,
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], false, 103),

  -- Psicose ------------------------------------------------------------------------------
  ('ESQUIZOFRENIA','Esquizofrenia','Esquizofrenia','PSICOSE',
    ARRAY['esquizofrenia'],'295.90',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 110),
  ('ESQUIZOAFETIVO','Transtorno Esquizoafetivo','Esquizoafetivo','PSICOSE',
    ARRAY['esquizoafetivo'],'295.70',
    ARRAY['ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 111),

  -- Somático ------------------------------------------------------------------------------
  ('SOMATIZACAO','Transtorno de Sintomas Somáticos','Somatização','SOMATICO',
    ARRAY['somatizacao','sintomas somaticos','psicossomatico'],'300.82',
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], true, 120),
  ('DOR_CRONICA','Dor crônica','Dor crônica','SOMATICO',
    ARRAY['dor cronica','fibromialgia'],NULL,
    ARRAY['ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], false, 121),

  -- Demandas de vida (não são diagnóstico, mas são o pão do psicólogo clínico) ----------
  ('LUTO','Processo de luto','Luto','VIDA',
    ARRAY['luto','perda','falecimento'],NULL,
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','LUTO']::clinical_module[], false, 130),
  ('BURNOUT','Esgotamento profissional (burnout)','Burnout','VIDA',
    ARRAY['burnout','esgotamento','estresse ocupacional','sindrome de burnout'],NULL,
    ARRAY['ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], false, 131),
  ('CONFLITO_CONJUGAL','Conflito conjugal / relacionamento','Conjugal','VIDA',
    ARRAY['conflito conjugal','relacionamento','casal','terapia de casal','separacao','divorcio'],NULL,
    ARRAY['ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], false, 132),
  ('CONFLITO_FAMILIAR','Conflito familiar','Familiar','VIDA',
    ARRAY['conflito familiar','familia','dinamica familiar'],NULL,
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], false, 133),
  ('PARENTALIDADE','Orientação de parentalidade','Parentalidade','VIDA',
    ARRAY['parentalidade','orientacao de pais','maternidade','paternidade'],NULL,
    ARRAY['ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], false, 134),
  ('PERINATAL','Saúde mental perinatal','Perinatal','VIDA',
    ARRAY['perinatal','pos parto','depressao pos parto','puerperio','gestacao'],NULL,
    ARRAY['ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL','PERINATAL']::clinical_module[], false, 135),
  ('AUTOESTIMA','Autoestima e autoimagem','Autoestima','VIDA',
    ARRAY['autoestima','autoimagem','autoconfianca'],NULL,
    ARRAY['CHILD','ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], false, 136),
  ('ORIENTACAO_PROFISSIONAL','Orientação profissional e de carreira','Carreira','VIDA',
    ARRAY['orientacao profissional','carreira','vocacional','orientacao vocacional'],NULL,
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], false, 137),
  ('IDENTIDADE_GENERO','Identidade de gênero e sexualidade','Identidade','VIDA',
    ARRAY['identidade de genero','disforia de genero','sexualidade','orientacao sexual'],NULL,
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], false, 138),
  ('DESENVOLVIMENTO_PESSOAL','Autoconhecimento e desenvolvimento pessoal','Autoconhecimento','VIDA',
    ARRAY['autoconhecimento','desenvolvimento pessoal','crescimento pessoal'],NULL,
    ARRAY['ADOLESCENT','ADULT']::patient_profile_type[], ARRAY['CLINICO_GERAL']::clinical_module[], false, 139)
ON CONFLICT (code) DO UPDATE
  SET label             = EXCLUDED.label,
      short_label       = EXCLUDED.short_label,
      category          = EXCLUDED.category,
      synonyms          = EXCLUDED.synonyms,
      dsm5              = EXCLUDED.dsm5,
      typical_profiles  = EXCLUDED.typical_profiles,
      suggested_modules = EXCLUDED.suggested_modules,
      is_diagnosis      = EXCLUDED.is_diagnosis,
      sort_order        = EXCLUDED.sort_order,
      updated_at        = now();

-- ---------------------------------------------------------------------------------
-- Migração dos diagnósticos legados. Nada é descartado: o que não casa vira
-- needs_review com o texto original preservado em raw_label.
-- ---------------------------------------------------------------------------------
INSERT INTO patient_conditions (patient_id, clinic_id, taxonomy_id, raw_label, is_primary, needs_review, noted_at)
SELECT
  p.id,
  p.clinic_id,
  public.match_clinical_taxonomy(d.value) AS taxonomy_id,
  d.value                                  AS raw_label,
  (d.ord = 1)                              AS is_primary,
  public.match_clinical_taxonomy(d.value) IS NULL AS needs_review,
  COALESCE(p.created_at::date, CURRENT_DATE)
FROM patients p
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.diagnoses_legacy, p.diagnoses, '[]'::jsonb))
  WITH ORDINALITY AS d(value, ord)
WHERE p.deleted_at IS NULL
  AND length(trim(d.value)) > 1
ON CONFLICT DO NOTHING;

-- Re-match auto-corretivo: quando o catálogo ganha um sinônimo novo, as pendências de
-- curadoria que passam a casar são resolvidas sozinhas na próxima execução.
UPDATE patient_conditions pc
   SET taxonomy_id  = public.match_clinical_taxonomy(pc.raw_label),
       needs_review = false,
       updated_at   = now()
 WHERE pc.needs_review
   AND public.match_clinical_taxonomy(pc.raw_label) IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM patient_conditions dup
      WHERE dup.patient_id = pc.patient_id
        AND dup.taxonomy_id = public.match_clinical_taxonomy(pc.raw_label)
        AND dup.id <> pc.id
   );

-- Limpeza do caso em que o re-match foi bloqueado por já existir a versão mapeada: a
-- linha órfã não-mapeada é redundante e some. Nenhuma informação é perdida — o rótulo
-- original continua em diagnoses_legacy.
DELETE FROM patient_conditions pc
 WHERE pc.taxonomy_id IS NULL
   AND public.match_clinical_taxonomy(pc.raw_label) IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM patient_conditions mapeada
      WHERE mapeada.patient_id = pc.patient_id
        AND mapeada.taxonomy_id = public.match_clinical_taxonomy(pc.raw_label)
   );

-- Alinha os módulos ativos ao que a taxonomia sugere para as condições do paciente.
UPDATE patients p
   SET active_modules = sub.modules
  FROM (
    SELECT pc.patient_id,
           (SELECT array_agg(DISTINCT m ORDER BY m)
              FROM (
                SELECT unnest(ct2.suggested_modules) AS m
                  FROM patient_conditions pc2
                  JOIN clinical_taxonomy ct2 ON ct2.id = pc2.taxonomy_id
                 WHERE pc2.patient_id = pc.patient_id
                UNION
                SELECT unnest(p2.active_modules) FROM patients p2 WHERE p2.id = pc.patient_id
              ) u
           ) AS modules
      FROM patient_conditions pc
      JOIN clinical_taxonomy ct ON ct.id = pc.taxonomy_id
     GROUP BY pc.patient_id
  ) sub
 WHERE p.id = sub.patient_id
   AND sub.modules IS NOT NULL
   AND p.active_modules <> sub.modules;

-- Dual-write: patients.diagnoses continua sendo a fonte lida pelo copiloto, pelo RAG e
-- pela UI de chips. A taxonomia passa a ser a fonte da verdade e projeta nela.
-- Projeta-se o rótulo CURTO: o terapeuta digitou "TDAH" e deve continuar lendo "TDAH".
-- A normalização entrega o ganho real (uma só grafia por condição) sem trocar o
-- vocabulário do profissional. O nome clínico completo fica em clinical_taxonomy.label,
-- disponível por join para o system prompt do copiloto.
CREATE OR REPLACE FUNCTION public.sync_patient_diagnoses()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_patient_id uuid := COALESCE(NEW.patient_id, OLD.patient_id);
BEGIN
  UPDATE patients
     SET diagnoses = COALESCE((
           SELECT jsonb_agg(COALESCE(ct.short_label, ct.label, pc.raw_label)
                            ORDER BY pc.is_primary DESC, pc.created_at)
             FROM patient_conditions pc
             LEFT JOIN clinical_taxonomy ct ON ct.id = pc.taxonomy_id
            WHERE pc.patient_id = v_patient_id
              AND pc.status IN ('active', 'in_investigation')
         ), '[]'::jsonb),
         updated_at = now()
   WHERE id = v_patient_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_patient_diagnoses ON patient_conditions;
CREATE TRIGGER trg_sync_patient_diagnoses
  AFTER INSERT OR UPDATE OR DELETE ON patient_conditions
  FOR EACH ROW EXECUTE FUNCTION public.sync_patient_diagnoses();

-- Projeta a normalização uma vez para os pacientes já migrados.
UPDATE patients p
   SET diagnoses = COALESCE((
         SELECT jsonb_agg(COALESCE(ct.short_label, ct.label, pc.raw_label)
                          ORDER BY pc.is_primary DESC, pc.created_at)
           FROM patient_conditions pc
           LEFT JOIN clinical_taxonomy ct ON ct.id = pc.taxonomy_id
          WHERE pc.patient_id = p.id
            AND pc.status IN ('active', 'in_investigation')
       ), '[]'::jsonb)
 WHERE EXISTS (SELECT 1 FROM patient_conditions pc WHERE pc.patient_id = p.id);

DROP TRIGGER IF EXISTS trg_patient_conditions_updated_at ON patient_conditions;
CREATE TRIGGER trg_patient_conditions_updated_at
  BEFORE UPDATE ON patient_conditions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_clinical_taxonomy_updated_at ON clinical_taxonomy;
CREATE TRIGGER trg_clinical_taxonomy_updated_at
  BEFORE UPDATE ON clinical_taxonomy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =====================================================================================
-- 4. PORTAL UNIVERSAL — acesso CAREGIVER x SELF
-- =====================================================================================
-- A tabela física continua patient_family_links (ADR-01). A view patient_portal_links é
-- o nome semântico usado pelo código novo.

ALTER TABLE patient_family_links
  ADD COLUMN IF NOT EXISTS access_level       portal_access_level NOT NULL DEFAULT 'CAREGIVER',
  ADD COLUMN IF NOT EXISTS is_primary_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revoked_at         timestamptz,
  ADD COLUMN IF NOT EXISTS last_access_at     timestamptz;

COMMENT ON COLUMN patient_family_links.access_level IS
  'CAREGIVER: responsável relatando sobre o paciente. SELF: o próprio paciente relatando sobre si.';
COMMENT ON COLUMN patient_family_links.revoked_at IS
  'Revogação de acesso ao portal sem apagar o histórico do vínculo.';

-- Um paciente tem no máximo um acesso SELF ativo; pode ter vários CAREGIVER.
CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_link_self_per_patient
  ON patient_family_links (patient_id)
  WHERE access_level = 'SELF' AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pfl_user_active
  ON patient_family_links (user_id, patient_id) WHERE revoked_at IS NULL;

CREATE OR REPLACE VIEW patient_portal_links
WITH (security_invoker = true) AS
  SELECT id, patient_id, family_member_id, clinic_id, user_id, relationship,
         access_level, is_primary_contact, last_access_at, created_at, created_by
    FROM patient_family_links
   WHERE revoked_at IS NULL;

COMMENT ON VIEW patient_portal_links IS
  'Alias semântico de patient_family_links para o Portal Universal. Use esta view em código novo.';

-- =====================================================================================
-- 5. DIÁRIO DINÂMICO
-- =====================================================================================
-- As colunas infantis (mood_score, sleep_quality, crisis_*) são mantidas: 19 registros
-- reais, o dashboard e o trigger de crisis_alerts dependem delas. O payload JSONB carrega
-- o que é específico de cada perfil/módulo.

ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS author_access_level portal_access_level NOT NULL DEFAULT 'CAREGIVER',
  ADD COLUMN IF NOT EXISTS portal_link_id      uuid REFERENCES patient_family_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS author_user_id      uuid;

COMMENT ON COLUMN diary_entries.payload IS
  'Campos dinâmicos por perfil. CAREGIVER infantil: {"sensorial":true,"escola":...}. SELF adulto: {"humor":2,"ansiedade":4,"gatilhos":["trabalho"],"adesao":true}.';
COMMENT ON COLUMN diary_entries.author_access_level IS
  'Quem escreveu: um cuidador observando de fora, ou o próprio paciente relatando de dentro. Muda a leitura clínica do dado.';

CREATE INDEX IF NOT EXISTS idx_diary_entries_payload ON diary_entries USING GIN (payload);
CREATE INDEX IF NOT EXISTS idx_diary_entries_patient_date
  ON diary_entries (patient_id, entry_date DESC) WHERE deleted_at IS NULL;

-- Preenche o autor dos registros existentes a partir do vínculo do family_member.
UPDATE diary_entries de
   SET portal_link_id = pfl.id,
       author_user_id = pfl.user_id
  FROM patient_family_links pfl
 WHERE de.portal_link_id IS NULL
   AND pfl.family_member_id = de.family_member_id
   AND pfl.patient_id = de.patient_id;

-- =====================================================================================
-- 6. MOTOR B2C — assinatura "Thery" e chat do paciente
-- =====================================================================================

CREATE TABLE IF NOT EXISTS patient_subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id             uuid NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  clinic_id              uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  portal_link_id         uuid REFERENCES patient_family_links(id) ON DELETE SET NULL,
  user_id                uuid,
  plan_code              text NOT NULL DEFAULT 'thery_apoio_mensal',
  stripe_customer_id     text,
  stripe_subscription_id text UNIQUE,
  stripe_price_id        text,
  status                 text NOT NULL DEFAULT 'incomplete'
                         CHECK (status IN ('incomplete','incomplete_expired','trialing','active',
                                           'past_due','canceled','unpaid','paused')),
  trial_start            timestamptz,
  trial_end              timestamptz,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  canceled_at            timestamptz,
  trial_warning_sent_at  timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE patient_subscriptions IS
  'Assinatura B2C do Acompanhante Thery, paga pelo próprio paciente. Independente de clinic_subscriptions.';
COMMENT ON COLUMN patient_subscriptions.trial_warning_sent_at IS
  'Marca de idempotência do e-mail "falta 1 dia para a cobrança" (D6). O Stripe só avisa 3 dias antes.';
COMMENT ON COLUMN patient_subscriptions.clinic_id IS
  'Clínica do paciente no momento da assinatura. Usado para escopo de leitura, nunca para cobrança.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_subscription_active
  ON patient_subscriptions (patient_id)
  WHERE status IN ('trialing','active','past_due','unpaid');
CREATE INDEX IF NOT EXISTS idx_patient_subscriptions_patient ON patient_subscriptions (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_subscriptions_customer ON patient_subscriptions (stripe_customer_id);
-- Suporte ao job diário de aviso de fim de trial.
CREATE INDEX IF NOT EXISTS idx_patient_subscriptions_trial_end
  ON patient_subscriptions (trial_end)
  WHERE status = 'trialing' AND trial_warning_sent_at IS NULL;

DROP TRIGGER IF EXISTS trg_patient_subscriptions_updated_at ON patient_subscriptions;
CREATE TRIGGER trg_patient_subscriptions_updated_at
  BEFORE UPDATE ON patient_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_copilot_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id       uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  portal_link_id  uuid REFERENCES patient_family_links(id) ON DELETE SET NULL,
  user_id         uuid NOT NULL,
  title           text,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  message_count   integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

COMMENT ON TABLE patient_copilot_threads IS
  'Conversas do paciente com o Acompanhante Thery. Isoladas do copiloto clínico do terapeuta (copilot_threads).';

CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_copilot_thread_active
  ON patient_copilot_threads (patient_id)
  WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_copilot_threads_user ON patient_copilot_threads (user_id);

DROP TRIGGER IF EXISTS trg_patient_copilot_threads_updated_at ON patient_copilot_threads;
CREATE TRIGGER trg_patient_copilot_threads_updated_at
  BEFORE UPDATE ON patient_copilot_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_copilot_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        uuid NOT NULL REFERENCES patient_copilot_threads(id) ON DELETE CASCADE,
  patient_id       uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id        uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  role             text NOT NULL CHECK (role IN ('user','assistant')),
  content          text NOT NULL,
  input_source     text NOT NULL DEFAULT 'text' CHECK (input_source IN ('text','audio')),
  risk_level       clinical_risk_level NOT NULL DEFAULT 'LOW',
  -- Coluna gerada: impossível ficar dessincronizada de risk_level.
  is_severe_risk   boolean GENERATED ALWAYS AS (risk_level = 'SEVERE'::clinical_risk_level) STORED,
  risk_signals     jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_detector    text CHECK (risk_detector IN ('lexicon','classifier','both','none')),
  emergency_protocol_shown boolean NOT NULL DEFAULT false,
  model            text,
  latency_ms       integer,
  tokens_in        integer,
  tokens_out       integer,
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

COMMENT ON TABLE patient_copilot_messages IS
  'Conteúdo bruto do chat do paciente. NÃO é legível pelo terapeuta via RLS e NÃO é vetorizado (ADR-06). O terapeuta recebe alertas e resumos consentidos.';
COMMENT ON COLUMN patient_copilot_messages.is_severe_risk IS
  'Coluna gerada a partir de risk_level. Não pode ser escrita diretamente, o que impede divergência entre a flag e a classificação.';
COMMENT ON COLUMN patient_copilot_messages.risk_detector IS
  'Qual camada detectou o risco: lexicon (determinística pré-LLM), classifier (Gemini), both, none.';

CREATE INDEX IF NOT EXISTS idx_patient_copilot_messages_thread
  ON patient_copilot_messages (thread_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_patient_copilot_messages_severe
  ON patient_copilot_messages (patient_id, created_at DESC) WHERE is_severe_risk;

-- Contador de uso para fair use sem count() pesado (mitigação do db-f1-micro, D9).
CREATE TABLE IF NOT EXISTS patient_copilot_usage (
  patient_id     uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  period_ym      text NOT NULL,
  messages_count integer NOT NULL DEFAULT 0,
  audio_seconds  integer NOT NULL DEFAULT 0,
  tokens_in      bigint  NOT NULL DEFAULT 0,
  tokens_out     bigint  NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (patient_id, period_ym)
);

COMMENT ON TABLE patient_copilot_usage IS
  'Agregado mensal de uso do Thery. Fair use tem degradação suave: nunca corta o acesso de quem está em sofrimento.';

-- Mantém thread e uso coerentes a cada mensagem.
CREATE OR REPLACE FUNCTION public.patient_copilot_after_message()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE patient_copilot_threads
     SET message_count   = message_count + 1,
         last_message_at = NEW.created_at,
         updated_at      = now()
   WHERE id = NEW.thread_id;

  IF NEW.role = 'user' THEN
    INSERT INTO patient_copilot_usage (patient_id, period_ym, messages_count, tokens_in, tokens_out)
    VALUES (NEW.patient_id, to_char(NEW.created_at, 'YYYY-MM'), 1,
            COALESCE(NEW.tokens_in, 0), COALESCE(NEW.tokens_out, 0))
    ON CONFLICT (patient_id, period_ym) DO UPDATE
      SET messages_count = patient_copilot_usage.messages_count + 1,
          tokens_in      = patient_copilot_usage.tokens_in + COALESCE(EXCLUDED.tokens_in, 0),
          tokens_out     = patient_copilot_usage.tokens_out + COALESCE(EXCLUDED.tokens_out, 0),
          updated_at     = now();
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_patient_copilot_after_message ON patient_copilot_messages;
CREATE TRIGGER trg_patient_copilot_after_message
  AFTER INSERT ON patient_copilot_messages
  FOR EACH ROW EXECUTE FUNCTION public.patient_copilot_after_message();

-- =====================================================================================
-- 7. CONSENTIMENTOS (LGPD art. 11 e 14)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS patient_consents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id      uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  portal_link_id uuid REFERENCES patient_family_links(id) ON DELETE SET NULL,
  user_id        uuid,
  consent_type   text NOT NULL CHECK (consent_type IN (
                   'B2C_TERMS',                -- termos do Acompanhante Thery
                   'AI_DISCLAIMER',            -- ciência de que a IA não é psicóloga
                   'CLINICAL_SUMMARY_SHARING', -- resumo consentido para o terapeuta
                   'GUARDIAN_CONSENT_MINOR',   -- consentimento do responsável (13-17)
                   'RISK_ALERT_NOTICE'         -- ciência de que risco severo sempre notifica
                 )),
  version        text NOT NULL,
  granted        boolean NOT NULL,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  granted_by_user_id uuid,
  ip_address     inet,
  user_agent     text,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE patient_consents IS
  'Trilha versionada e auditável de consentimentos. RISK_ALERT_NOTICE não é revogável: o alerta de risco severo é dever de cuidado.';

CREATE INDEX IF NOT EXISTS idx_patient_consents_patient ON patient_consents (patient_id, consent_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_consent_current
  ON patient_consents (patient_id, consent_type, version) WHERE revoked_at IS NULL;

-- O compartilhamento de resumo clínico é opt-in explícito e verificável.
CREATE OR REPLACE FUNCTION public.patient_allows_summary_sharing(p_patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM patient_consents
     WHERE patient_id = p_patient_id
       AND consent_type = 'CLINICAL_SUMMARY_SHARING'
       AND granted
       AND revoked_at IS NULL
  );
$$;

-- =====================================================================================
-- 8. ALERTAS CLÍNICOS UNIFICADOS
-- =====================================================================================
-- crisis_alerts (11 linhas, alimentada por trigger do diário) continua intacta.
-- clinical_alerts nasce como o modelo unificado: diário, check-in e Acompanhante.

CREATE TABLE IF NOT EXISTS clinical_alerts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinic_id        uuid NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  professional_id  uuid REFERENCES professionals(id) ON DELETE SET NULL,
  source           clinical_alert_source NOT NULL,
  severity         clinical_risk_level NOT NULL,
  status           clinical_alert_status NOT NULL DEFAULT 'UNREAD',
  title            text NOT NULL,
  summary          text NOT NULL,
  source_ref_id    uuid,
  dedupe_key       text,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  acknowledged_at  timestamptz,
  acknowledged_by  uuid,
  resolved_at      timestamptz,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE clinical_alerts IS
  'Triagem do terapeuta. summary é um resumo gerado, NUNCA a transcrição literal do chat do paciente (ADR-06).';
COMMENT ON COLUMN clinical_alerts.dedupe_key IS
  'Agregação anti-fadiga de alarme: normalmente patient_id + data + severidade. Evita inundar o terapeuta.';
COMMENT ON COLUMN clinical_alerts.source_ref_id IS
  'Referência fraca (sem FK) para a origem: patient_copilot_messages.id ou diary_entries.id.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_clinical_alerts_dedupe
  ON clinical_alerts (dedupe_key) WHERE dedupe_key IS NOT NULL AND status = 'UNREAD';
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_triage
  ON clinical_alerts (clinic_id, status, severity DESC, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_patient
  ON clinical_alerts (patient_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_professional
  ON clinical_alerts (professional_id, status) WHERE status = 'UNREAD';

-- =====================================================================================
-- 9. IDEMPOTÊNCIA DO WEBHOOK STRIPE
-- =====================================================================================

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id     text PRIMARY KEY,
  event_type   text NOT NULL,
  account_type text CHECK (account_type IN ('clinic','patient','unknown')),
  livemode     boolean,
  status       text NOT NULL DEFAULT 'received'
               CHECK (status IN ('received','processed','failed','ignored')),
  attempts     integer NOT NULL DEFAULT 0,
  error        text,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

COMMENT ON TABLE stripe_webhook_events IS
  'Dedupe por event.id. O webhook atual reprocessa eventos repetidos e duplica histórico em clinic_subscriptions.';

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON stripe_webhook_events (status, received_at DESC);

-- =====================================================================================
-- 10. HELPERS DE RLS
-- =====================================================================================
-- SECURITY DEFINER com search_path fixo para evitar recursão de RLS e shadowing.

CREATE OR REPLACE FUNCTION public.portal_patient_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pfl.patient_id
    FROM patient_family_links pfl
   WHERE pfl.user_id = auth.uid()
     AND pfl.revoked_at IS NULL;
$$;

COMMENT ON FUNCTION public.portal_patient_ids() IS
  'Pacientes que o usuário logado no portal pode acessar (qualquer access_level).';

CREATE OR REPLACE FUNCTION public.portal_self_patient_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pfl.patient_id
    FROM patient_family_links pfl
   WHERE pfl.user_id = auth.uid()
     AND pfl.revoked_at IS NULL
     AND pfl.access_level = 'SELF';
$$;

COMMENT ON FUNCTION public.portal_self_patient_ids() IS
  'Pacientes em que o usuário logado é o PRÓPRIO paciente. Só quem é SELF conversa com o Thery.';

CREATE OR REPLACE FUNCTION public.clinic_patient_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
    FROM patients p
   WHERE p.deleted_at IS NULL
     AND (
       -- profissional: apenas a própria carteira
       p.professional_id IN (
         SELECT prof.id FROM professionals prof
          WHERE prof.user_id = auth.uid() AND prof.deleted_at IS NULL
       )
       -- admin da clínica: toda a clínica
       OR (
         (auth.app_metadata() ->> 'role') = 'clinic_admin'
         AND p.clinic_id = NULLIF(auth.app_metadata() ->> 'clinic_id', '')::uuid
       )
     );
$$;

-- =====================================================================================
-- 11. RLS — POLICIES
-- =====================================================================================

ALTER TABLE clinical_taxonomy        ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_conditions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_copilot_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_copilot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_copilot_usage    ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_consents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events    ENABLE ROW LEVEL SECURITY;

-- --- clinical_taxonomy: catálogo público de leitura ---------------------------------
DROP POLICY IF EXISTS clinical_taxonomy_read ON clinical_taxonomy;
CREATE POLICY clinical_taxonomy_read ON clinical_taxonomy
  FOR SELECT USING (active);

DROP POLICY IF EXISTS clinical_taxonomy_master ON clinical_taxonomy;
CREATE POLICY clinical_taxonomy_master ON clinical_taxonomy
  FOR ALL USING ((auth.app_metadata() ->> 'role') = 'master');

-- --- patient_conditions -------------------------------------------------------------
DROP POLICY IF EXISTS patient_conditions_master ON patient_conditions;
CREATE POLICY patient_conditions_master ON patient_conditions
  FOR ALL USING ((auth.app_metadata() ->> 'role') = 'master');

DROP POLICY IF EXISTS patient_conditions_clinic ON patient_conditions;
CREATE POLICY patient_conditions_clinic ON patient_conditions
  FOR ALL USING (patient_id IN (SELECT public.clinic_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.clinic_patient_ids()));

-- Portal lê o próprio quadro clínico, nunca escreve.
DROP POLICY IF EXISTS patient_conditions_portal_read ON patient_conditions;
CREATE POLICY patient_conditions_portal_read ON patient_conditions
  FOR SELECT USING (patient_id IN (SELECT public.portal_patient_ids()));

-- --- patient_subscriptions ----------------------------------------------------------
DROP POLICY IF EXISTS patient_subscriptions_master ON patient_subscriptions;
CREATE POLICY patient_subscriptions_master ON patient_subscriptions
  FOR ALL USING ((auth.app_metadata() ->> 'role') = 'master');

-- O paciente lê a própria assinatura. A escrita é exclusiva do webhook (service role).
DROP POLICY IF EXISTS patient_subscriptions_portal_read ON patient_subscriptions;
CREATE POLICY patient_subscriptions_portal_read ON patient_subscriptions
  FOR SELECT USING (patient_id IN (SELECT public.portal_self_patient_ids()));

-- O terapeuta enxerga se o paciente tem Thery ativo, para contextualizar o cuidado.
DROP POLICY IF EXISTS patient_subscriptions_clinic_read ON patient_subscriptions;
CREATE POLICY patient_subscriptions_clinic_read ON patient_subscriptions
  FOR SELECT USING (patient_id IN (SELECT public.clinic_patient_ids()));

-- --- patient_copilot_threads --------------------------------------------------------
-- Deliberadamente NÃO existe policy de leitura para professional/clinic_admin/master:
-- o conteúdo do desabafo do paciente não é material de prontuário (ADR-06).
DROP POLICY IF EXISTS patient_copilot_threads_portal ON patient_copilot_threads;
CREATE POLICY patient_copilot_threads_portal ON patient_copilot_threads
  FOR SELECT USING (
    deleted_at IS NULL
    AND user_id = auth.uid()
    AND patient_id IN (SELECT public.portal_self_patient_ids())
  );

-- --- patient_copilot_messages -------------------------------------------------------
-- Leitura: apenas o próprio paciente.
-- Escrita: NENHUMA policy para usuário. INSERT direto do cliente burlaria o classificador
-- de risco (ADR-05); a gravação é feita pelo backend com service role.
DROP POLICY IF EXISTS patient_copilot_messages_portal_read ON patient_copilot_messages;
CREATE POLICY patient_copilot_messages_portal_read ON patient_copilot_messages
  FOR SELECT USING (
    deleted_at IS NULL
    AND patient_id IN (SELECT public.portal_self_patient_ids())
    AND thread_id IN (
      SELECT t.id FROM patient_copilot_threads t
       WHERE t.user_id = auth.uid() AND t.deleted_at IS NULL
    )
  );

-- --- patient_copilot_usage ----------------------------------------------------------
DROP POLICY IF EXISTS patient_copilot_usage_portal_read ON patient_copilot_usage;
CREATE POLICY patient_copilot_usage_portal_read ON patient_copilot_usage
  FOR SELECT USING (patient_id IN (SELECT public.portal_self_patient_ids()));

-- --- patient_consents ---------------------------------------------------------------
DROP POLICY IF EXISTS patient_consents_master ON patient_consents;
CREATE POLICY patient_consents_master ON patient_consents
  FOR ALL USING ((auth.app_metadata() ->> 'role') = 'master');

DROP POLICY IF EXISTS patient_consents_portal_read ON patient_consents;
CREATE POLICY patient_consents_portal_read ON patient_consents
  FOR SELECT USING (patient_id IN (SELECT public.portal_patient_ids()));

-- A clínica precisa comprovar a base legal do que recebe.
DROP POLICY IF EXISTS patient_consents_clinic_read ON patient_consents;
CREATE POLICY patient_consents_clinic_read ON patient_consents
  FOR SELECT USING (patient_id IN (SELECT public.clinic_patient_ids()));

-- --- clinical_alerts ----------------------------------------------------------------
-- Este é o canal legítimo pelo qual o terapeuta sabe o que aconteceu no B2C.
DROP POLICY IF EXISTS clinical_alerts_master ON clinical_alerts;
CREATE POLICY clinical_alerts_master ON clinical_alerts
  FOR ALL USING ((auth.app_metadata() ->> 'role') = 'master');

DROP POLICY IF EXISTS clinical_alerts_clinic_read ON clinical_alerts;
CREATE POLICY clinical_alerts_clinic_read ON clinical_alerts
  FOR SELECT USING (patient_id IN (SELECT public.clinic_patient_ids()));

-- Triagem: o terapeuta só pode marcar como visto/resolvido, não editar o conteúdo.
DROP POLICY IF EXISTS clinical_alerts_clinic_ack ON clinical_alerts;
CREATE POLICY clinical_alerts_clinic_ack ON clinical_alerts
  FOR UPDATE USING (patient_id IN (SELECT public.clinic_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.clinic_patient_ids()));

-- O paciente NÃO lê os alertas gerados sobre ele: exibi-los criaria efeito de vigilância
-- e poderia inibir o relato honesto. A transparência é dada no texto do consentimento.

-- --- stripe_webhook_events ----------------------------------------------------------
DROP POLICY IF EXISTS stripe_webhook_events_master ON stripe_webhook_events;
CREATE POLICY stripe_webhook_events_master ON stripe_webhook_events
  FOR SELECT USING ((auth.app_metadata() ->> 'role') = 'master');

-- --- diary_entries: acesso do portal por vínculo (complementa a policy por family_member)
DROP POLICY IF EXISTS diary_entries_portal_read ON diary_entries;
CREATE POLICY diary_entries_portal_read ON diary_entries
  FOR SELECT USING (
    deleted_at IS NULL
    AND patient_id IN (SELECT public.portal_patient_ids())
  );

DROP POLICY IF EXISTS diary_entries_portal_insert ON diary_entries;
CREATE POLICY diary_entries_portal_insert ON diary_entries
  FOR INSERT WITH CHECK (
    patient_id IN (SELECT public.portal_patient_ids())
    AND (author_user_id IS NULL OR author_user_id = auth.uid())
  );

DROP POLICY IF EXISTS diary_entries_portal_update_own ON diary_entries;
CREATE POLICY diary_entries_portal_update_own ON diary_entries
  FOR UPDATE USING (
    deleted_at IS NULL
    AND author_user_id = auth.uid()
    AND patient_id IN (SELECT public.portal_patient_ids())
  )
  WITH CHECK (patient_id IN (SELECT public.portal_patient_ids()));

-- =====================================================================================
-- 12. GRANTS
-- =====================================================================================
-- Correção de bug pré-existente: copilot_threads/copilot_messages (B2B) foram criadas sem
-- GRANT para unithery_app e authenticated, o que impede a persistência das threads do
-- copiloto do terapeuta via PostgREST. Ambas estão com 0 linhas em produção.

GRANT SELECT, INSERT, UPDATE, DELETE ON copilot_threads, copilot_messages TO unithery_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON copilot_threads, copilot_messages TO authenticated;

-- Catálogo: leitura ampla.
GRANT SELECT ON clinical_taxonomy TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON clinical_taxonomy TO unithery_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON patient_conditions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON patient_conditions TO unithery_app;

-- Assinatura: usuário só lê; escrita é do backend/webhook.
GRANT SELECT ON patient_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON patient_subscriptions TO unithery_app;

-- Chat: usuário só lê. Sem INSERT/UPDATE para authenticated — a gravação passa
-- obrigatoriamente pelo backend, que roda o classificador de risco antes.
GRANT SELECT ON patient_copilot_threads  TO authenticated;
GRANT SELECT ON patient_copilot_messages TO authenticated;
GRANT SELECT ON patient_copilot_usage    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON patient_copilot_threads  TO unithery_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON patient_copilot_messages TO unithery_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON patient_copilot_usage    TO unithery_app;

GRANT SELECT ON patient_consents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON patient_consents TO unithery_app;

-- Alertas: terapeuta lê e faz triagem (UPDATE de status).
GRANT SELECT, UPDATE ON clinical_alerts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON clinical_alerts TO unithery_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON stripe_webhook_events TO unithery_app;

GRANT SELECT ON patient_portal_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON patient_portal_links TO unithery_app;

GRANT EXECUTE ON FUNCTION public.portal_patient_ids()            TO authenticated, unithery_app;
GRANT EXECUTE ON FUNCTION public.portal_self_patient_ids()       TO authenticated, unithery_app;
GRANT EXECUTE ON FUNCTION public.clinic_patient_ids()            TO authenticated, unithery_app;
GRANT EXECUTE ON FUNCTION public.patient_allows_summary_sharing(uuid) TO authenticated, unithery_app;
GRANT EXECUTE ON FUNCTION public.derive_profile_type(date)       TO authenticated, unithery_app;
GRANT EXECUTE ON FUNCTION public.match_clinical_taxonomy(text)   TO authenticated, unithery_app;
GRANT EXECUTE ON FUNCTION public.normalize_clinical_label(text)  TO authenticated, unithery_app;

COMMIT;
