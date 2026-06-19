import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { PatientCrisisCalendarInput } from './schema.ts';

export interface CrisisCalendarDay {
  date: string;
  filled: boolean;
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level: number | null;
  categories: string[];
  notes: string | null;
  family_member_id: string;
}

export interface CrisisCalendarSummary {
  total_entries: number;
  crisis_count: number;
  fill_rate: number;
}

export interface PatientCrisisCalendarResponse {
  patient_id: string;
  year: number;
  month: number;
  days: CrisisCalendarDay[];
  summary: CrisisCalendarSummary;
}

/**
 * Fetches the crisis calendar for a specific patient.
 * Only accessible by professionals/clinic_admins/masters who own that patient.
 */
export async function getPatientCrisisCalendar(
  payload: PatientCrisisCalendarInput,
  caller: AuthenticatedUser,
): Promise<PatientCrisisCalendarResponse> {
  const now = new Date();
  const year = payload.year ?? now.getFullYear();
  const month = payload.month ?? now.getMonth() + 1;
  const patientId = payload.patient_id;

  const supabase = createServiceClient();

  // Verify the caller has access to this patient
  if (caller.role === 'professional') {
    const { data: patient, error: patientErr } = await supabase
      .from('patients')
      .select('id, professional_id, clinic_id')
      .eq('id', patientId)
      .is('deleted_at', null)
      .maybeSingle();

    if (patientErr || !patient) {
      throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
    }

    // Professional must own the patient or be in the same clinic
    const { data: prof } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!prof || patient.professional_id !== prof.id) {
      throw new AppError({ code: 'ACCESS_DENIED', message: 'Sem acesso a este paciente', statusCode: 403 });
    }
  } else if (caller.role === 'clinic_admin') {
    // Clinic admin can see patients of their clinic
    const { data: patient } = await supabase
      .from('patients')
      .select('id, clinic_id')
      .eq('id', patientId)
      .eq('clinic_id', caller.clinic_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!patient) {
      throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
    }
  }
  // master can access all patients — no additional check needed

  // Call the RPC
  const { data, error } = await supabase.rpc('get_patient_crisis_calendar', {
    p_patient_id: patientId,
    p_year: year,
    p_month: month,
  });

  if (error) {
    throw new AppError({ code: 'CALENDAR_FETCH_FAILED', message: error.message, statusCode: 500 });
  }

  const result = data as PatientCrisisCalendarResponse | null;

  return {
    patient_id: patientId,
    year,
    month,
    days: result?.days ?? [],
    summary: result?.summary ?? { total_entries: 0, crisis_count: 0, fill_rate: 0 },
  };
}
