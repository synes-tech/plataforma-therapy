import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { assertFamilyOwnsPatient } from '../_shared/family-access.ts';

export interface CalendarDayStatus {
  date: string;
  filled: boolean;
  mood_score?: number;
  crisis_occurred?: boolean;
}

export interface FamilyCalendarResponse {
  patient_id: string;
  year: number;
  month: number;
  days: CalendarDayStatus[];
}

export async function getFamilyCalendarStatus(
  payload: { year?: number; month?: number; patient_id?: string },
  caller: AuthenticatedUser,
): Promise<FamilyCalendarResponse> {
  const now = new Date();
  const year = payload.year ?? now.getFullYear();
  const month = payload.month ?? now.getMonth() + 1;

  const link = await assertFamilyOwnsPatient(caller.id, payload.patient_id);
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc('get_family_calendar_month', {
    p_user_id: caller.id,
    p_year: year,
    p_month: month,
  });

  if (error) {
    throw new AppError({ code: 'CALENDAR_FETCH_FAILED', message: error.message, statusCode: 500 });
  }

  const row = data as { found: boolean; days?: CalendarDayStatus[] };
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
