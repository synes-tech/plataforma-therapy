import { createServiceClient } from '../supabase.ts';
import {
  COMPANION_DIARY_LIMIT,
  COMPANION_SESSION_LIMIT,
  extractCompanionSessionReport,
  type CompanionMemory,
  type CompanionMemoryDiary,
  type CompanionMemoryPatient,
  type CompanionMemorySession,
} from './companion-memory.ts';

export async function loadCompanionMemory(patientId: string): Promise<CompanionMemory> {
  const empty: CompanionMemory = { patient: null, diaries: [], sessions: [] };
  try {
    const supabase = createServiceClient();
    const [patientResult, diaryResult, sessionResult] = await Promise.all([
      supabase
        .from('patients')
        .select(
          'queixa_principal, objetivos_terapeuticos, hiperfocos_interesses, escolaridade_ocupacao, composicao_familiar, informacoes_adicionais',
        )
        .eq('id', patientId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('diary_entries')
        .select('entry_date, mood_score, sleep_quality, crisis_occurred, notes')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('entry_date', { ascending: false })
        .limit(COMPANION_DIARY_LIMIT),
      supabase
        .from('session_notes')
        .select('created_at, content')
        .eq('patient_id', patientId)
        .eq('status', 'approved')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(COMPANION_SESSION_LIMIT),
    ]);

    const sessions: CompanionMemorySession[] = [];
    for (const row of (sessionResult.data ?? []) as Array<{ created_at: string; content: unknown }>) {
      const patient_report = extractCompanionSessionReport(row.content);
      if (patient_report) sessions.push({ created_at: row.created_at, patient_report });
    }

    return {
      patient: (patientResult.data as CompanionMemoryPatient | null) ?? null,
      diaries: (diaryResult.data ?? []) as CompanionMemoryDiary[],
      sessions,
    };
  } catch {
    return empty;
  }
}
