export interface PatientRecordPayload {
  patient_id: string;
}

export interface PatientInfo {
  id: string;
  name: string;
  birth_date: string;
  gender: string;
  diagnoses: string[];
  clinical_observations: string | null;
  status: string;
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

export interface SessionNoteSummary {
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

export interface DiaryEntrySummary {
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

export interface PatientRecordResponse {
  patient: PatientInfo;
  session_notes: SessionNoteSummary[];
  recent_diary: DiaryEntrySummary[];
  evolution: EvolutionWeek[];
  upcoming_sessions: UpcomingSession[];
  total_sessions: number;
}
