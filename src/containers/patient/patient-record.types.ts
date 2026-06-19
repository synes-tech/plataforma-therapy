export type PatientRecordTab = 'copilot' | 'overview' | 'checkins' | 'clinical' | 'documents';

export interface PatientInfo {
  id: string;
  name: string;
  birth_date: string;
  gender: string;
  diagnoses: string[];
  clinical_observations: string | null;
  status: string;
  status_vinculo?: 'ativo' | 'desvinculado';
  created_at: string;
  nome_social: string | null;
  escolaridade_ocupacao: string | null;
  queixa_principal: string | null;
  medicamentos: string | null;
  acompanhamento_multi: string[];
  composicao_familiar: string | null;
  responsaveis: string | null;
  objetivos_terapeuticos: string | null;
  hiperfocos_interesses: string | null;
  informacoes_adicionais: string | null;
  foto_url: string | null;
}

export interface SessionNote {
  id: string;
  status: string;
  content: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  ai_generated: boolean;
  approved_at: string | null;
  created_at: string;
}

export interface DiaryEntry {
  id: string;
  entry_date: string;
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level: number | null;
  categories: string[];
  notes: string | null;
}

export interface EvolutionWeek {
  week_start: string;
  avg_mood: number;
  avg_sleep: number;
  crisis_count: number;
  total_entries: number;
}

export interface UpcomingSession {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
}

export interface PatientRecordData {
  patient: PatientInfo;
  session_notes: SessionNote[];
  recent_diary: DiaryEntry[];
  evolution: EvolutionWeek[];
  upcoming_sessions: UpcomingSession[];
  total_sessions: number;
}

export function normalizePatientInfo(raw: Partial<PatientInfo> & Pick<PatientInfo, 'id' | 'name' | 'birth_date' | 'gender' | 'diagnoses' | 'status' | 'created_at'>): PatientInfo {
  return {
    ...raw,
    clinical_observations: raw.clinical_observations ?? null,
    nome_social: raw.nome_social ?? null,
    escolaridade_ocupacao: raw.escolaridade_ocupacao ?? null,
    queixa_principal: raw.queixa_principal ?? null,
    medicamentos: raw.medicamentos ?? null,
    acompanhamento_multi: raw.acompanhamento_multi ?? [],
    composicao_familiar: raw.composicao_familiar ?? null,
    responsaveis: raw.responsaveis ?? null,
    objetivos_terapeuticos: raw.objetivos_terapeuticos ?? null,
    hiperfocos_interesses: raw.hiperfocos_interesses ?? null,
    informacoes_adicionais: raw.informacoes_adicionais ?? null,
    foto_url: raw.foto_url ?? null,
    status_vinculo: (raw.status_vinculo as PatientInfo['status_vinculo']) ?? 'ativo',
  } as PatientInfo;
}
