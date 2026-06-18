import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  PatientRecordPayload,
  PatientRecordResponse,
} from './types.ts';

/**
 * Get Patient Record — Aggregated clinical history
 *
 * Returns: patient info + session notes (last 20) + diary entries (last 14 days)
 *        + weekly evolution + upcoming schedule
 *
 * RLS enforced + explicit ownership verification
 */
export async function getPatientRecord(
  payload: PatientRecordPayload,
  caller: AuthenticatedUser,
): Promise<PatientRecordResponse> {
  const supabase = createServiceClient();

  // ============================================================
  // STEP 1: Fetch patient and verify ownership
  // ============================================================
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select(`
      id, name, birth_date, gender, diagnoses, clinical_observations, status, status_vinculo, created_at, professional_id, clinic_id, foto_url,
      nome_social, escolaridade_ocupacao, queixa_principal, medicamentos, acompanhamento_multi,
      composicao_familiar, responsaveis, objetivos_terapeuticos, hiperfocos_interesses, informacoes_adicionais
    `)
    .eq('id', payload.patient_id)
    .is('deleted_at', null)
    .single();

  if (patientError || !patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  // Verify caller has access to this patient
  if (caller.role === 'professional') {
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', caller.id)
      .eq('id', patient.professional_id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new ForbiddenError('Você não tem acesso a este paciente');
    }
  } else if (caller.role === 'clinic_admin') {
    if (caller.clinic_id !== patient.clinic_id) {
      throw new ForbiddenError('Paciente não pertence à sua clínica');
    }
  }
  // master has unrestricted access

  // ============================================================
  // STEP 2: Fetch session notes (last 20, ordered by most recent)
  // ============================================================
  const { data: sessionNotes } = await supabase
    .from('session_notes')
    .select('id, status, content, ai_generated, approved_at, created_at')
    .eq('patient_id', payload.patient_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  // ============================================================
  // STEP 3: Fetch recent diary entries (last 14 days)
  // ============================================================
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: diaryEntries } = await supabase
    .from('diary_entries')
    .select('id, entry_date, mood_score, sleep_quality, crisis_occurred, crisis_level, categories, notes, audio_note_url, transcricao')
    .eq('patient_id', payload.patient_id)
    .is('deleted_at', null)
    .gte('entry_date', fourteenDaysAgo)
    .order('entry_date', { ascending: false });

  // ============================================================
  // STEP 4: Fetch weekly evolution (materialized view)
  // ============================================================
  const { data: evolution } = await supabase
    .from('patient_evolution_weekly')
    .select('week_start, avg_mood, avg_sleep, crisis_count, total_entries')
    .eq('patient_id', payload.patient_id)
    .order('week_start', { ascending: false })
    .limit(12);

  // ============================================================
  // STEP 5: Fetch upcoming sessions
  // ============================================================
  const { data: upcomingSessions } = await supabase
    .from('therapist_schedule')
    .select('id, scheduled_at, duration_minutes, status')
    .eq('patient_id', payload.patient_id)
    .is('deleted_at', null)
    .gte('scheduled_at', new Date().toISOString())
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: true })
    .limit(5);

  // ============================================================
  // STEP 6: Total session count
  // ============================================================
  const { count: totalSessions } = await supabase
    .from('session_notes')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', payload.patient_id)
    .is('deleted_at', null);

  return {
    patient: {
      id: patient.id,
      name: patient.name,
      birth_date: patient.birth_date,
      gender: patient.gender,
      diagnoses: patient.diagnoses,
      clinical_observations: patient.clinical_observations,
      status: patient.status,
      created_at: patient.created_at,
      nome_social: patient.nome_social ?? null,
      escolaridade_ocupacao: patient.escolaridade_ocupacao ?? null,
      queixa_principal: patient.queixa_principal ?? null,
      medicamentos: patient.medicamentos ?? null,
      acompanhamento_multi: (patient.acompanhamento_multi as string[] | null) ?? [],
      composicao_familiar: patient.composicao_familiar ?? null,
      responsaveis: patient.responsaveis ?? null,
      objetivos_terapeuticos: patient.objetivos_terapeuticos ?? null,
      hiperfocos_interesses: patient.hiperfocos_interesses ?? null,
      informacoes_adicionais: patient.informacoes_adicionais ?? null,
      foto_url: patient.foto_url ?? null,
    },
    session_notes: (sessionNotes ?? []).map((n) => ({
      id: n.id,
      status: n.status,
      content: n.content as PatientRecordResponse['session_notes'][0]['content'],
      ai_generated: n.ai_generated,
      approved_at: n.approved_at,
      created_at: n.created_at,
    })),
    recent_diary: (diaryEntries ?? []).map((d) => ({
      id: d.id,
      entry_date: d.entry_date,
      mood_score: d.mood_score,
      sleep_quality: d.sleep_quality,
      crisis_occurred: d.crisis_occurred,
      crisis_level: d.crisis_level,
      categories: d.categories as string[],
      notes: d.notes,
    })),
    evolution: (evolution ?? []).map((e) => ({
      week_start: e.week_start,
      avg_mood: e.avg_mood,
      avg_sleep: e.avg_sleep,
      crisis_count: e.crisis_count,
      total_entries: e.total_entries,
    })),
    upcoming_sessions: (upcomingSessions ?? []).map((s) => ({
      id: s.id,
      scheduled_at: s.scheduled_at,
      duration_minutes: s.duration_minutes,
      status: s.status,
    })),
    total_sessions: totalSessions ?? 0,
  };
}
