import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { assertFamilyOwnsPatient } from '../_shared/family-access.ts';
import type { ScheduledTherapiesInput } from './schema.ts';

export interface ScheduledTherapySession {
  id: string;
  schedule_id?: string | null;
  session_note_id?: string | null;
  scheduled_at: string;
  time: string;
  therapist_name: string;
  status: string;
  duration_minutes: number;
  title: string;
  has_shared_report?: boolean;
}

export interface ScheduledTherapyDay {
  date: string;
  sessions: ScheduledTherapySession[];
}

export interface ScheduledTherapiesResponse {
  patient_id: string;
  year: number;
  month: number;
  days: ScheduledTherapyDay[];
}

export async function getPatientScheduledTherapies(
  payload: ScheduledTherapiesInput,
  caller: AuthenticatedUser,
): Promise<ScheduledTherapiesResponse> {
  const now = new Date();
  const year = payload.year ?? now.getFullYear();
  const month = payload.month ?? now.getMonth() + 1;

  const link = await assertFamilyOwnsPatient(caller.id, payload.patient_id);
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('get_family_scheduled_therapies_month', {
    p_user_id: caller.id,
    p_year: year,
    p_month: month,
  });

  if (error) {
    throw new AppError({ code: 'SCHEDULE_FETCH_FAILED', message: error.message, statusCode: 500 });
  }

  const row = data as { found: boolean; days?: ScheduledTherapyDay[] };
  if (!row?.found) {
    throw new AppError({ code: 'NO_PATIENT_LINK', message: 'Nenhum paciente vinculado', statusCode: 403 });
  }

  return {
    patient_id: link.patient_id,
    year,
    month,
    days: row.days ?? [],
  };
}
