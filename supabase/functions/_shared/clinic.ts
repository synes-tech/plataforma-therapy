import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { AuthenticatedUser } from './auth.ts';
import { AppError } from './errors.ts';

/**
 * Resolves the clinic_id for the authenticated user.
 * Prefers the JWT claim; falls back to the clinic_admins table.
 * Throws if the user is not linked to any clinic.
 */
export async function resolveClinicId(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
): Promise<string> {
  if (user.clinic_id) return user.clinic_id;

  const { data: adminRecord } = await supabase
    .from('clinic_admins')
    .select('clinic_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (adminRecord?.clinic_id) return adminRecord.clinic_id;

  // Solo professional (consultório): clinic_id lives in the professionals table
  const { data: profRecord } = await supabase
    .from('professionals')
    .select('clinic_id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (profRecord?.clinic_id) return profRecord.clinic_id;

  const email = user.email?.trim().toLowerCase();
  if (email) {
    const { data: adminByEmail } = await supabase
      .from('clinic_admins')
      .select('clinic_id')
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle();
    if (adminByEmail?.clinic_id) return adminByEmail.clinic_id;

    const { data: profByEmail } = await supabase
      .from('professionals')
      .select('clinic_id')
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle();
    if (profByEmail?.clinic_id) return profByEmail.clinic_id;
  }

  throw new AppError({
    code: 'NO_CLINIC',
    message: 'Usuário não vinculado a uma clínica',
    statusCode: 400,
  });
}

export type OwnerRecordRef =
  | { kind: 'clinic_admin'; id: string }
  | { kind: 'professional'; id: string };

/** Localiza o perfil do dono por user_id e, se preciso, por e-mail. */
export async function resolveOwnerRecord(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
): Promise<OwnerRecordRef | null> {
  const { data: adminById } = await supabase
    .from('clinic_admins')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (adminById?.id) return { kind: 'clinic_admin', id: adminById.id };

  const { data: profById } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (profById?.id) return { kind: 'professional', id: profById.id };

  const email = user.email?.trim().toLowerCase();
  if (!email) return null;

  const { data: adminByEmail } = await supabase
    .from('clinic_admins')
    .select('id')
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();
  if (adminByEmail?.id) return { kind: 'clinic_admin', id: adminByEmail.id };

  const { data: profByEmail } = await supabase
    .from('professionals')
    .select('id')
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();
  if (profByEmail?.id) return { kind: 'professional', id: profByEmail.id };

  return null;
}

/**
 * Resolves the display name of the clinic owner (admin or solo professional).
 */
export async function resolveOwnerName(
  supabase: SupabaseClient,
  user: AuthenticatedUser,
): Promise<string> {
  const ownerRef = await resolveOwnerRecord(supabase, user);
  if (ownerRef?.kind === 'clinic_admin') {
    const { data: admin } = await supabase
      .from('clinic_admins')
      .select('name')
      .eq('id', ownerRef.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (admin?.name) return admin.name;
  }
  if (ownerRef?.kind === 'professional') {
    const { data: prof } = await supabase
      .from('professionals')
      .select('name')
      .eq('id', ownerRef.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (prof?.name) return prof.name;
  }

  return user.email.split('@')[0] ?? 'Admin';
}

/**
 * Computes AI usage for the current billing month for a clinic.
 * Used by both settings and billing screens (IA metering).
 */
export async function getMonthlyAiUsage(
  supabase: SupabaseClient,
  clinicId: string,
): Promise<{ ai_reports: number; audio_minutes: number }> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const since = monthStart.toISOString();

  const { data: patients } = await supabase
    .from('patients')
    .select('id')
    .eq('clinic_id', clinicId)
    .is('deleted_at', null);

  const patientIds = (patients ?? []).map((p: { id: string }) => p.id);

  let aiReports = 0;
  if (patientIds.length > 0) {
    const { count } = await supabase
      .from('session_notes')
      .select('id', { count: 'exact', head: true })
      .in('patient_id', patientIds)
      .gte('created_at', since)
      .is('deleted_at', null);
    aiReports = count ?? 0;
  }

  let audioMinutes = 0;
  const { data: recordings } = await supabase
    .from('audio_recordings')
    .select('duration_seconds')
    .eq('clinic_id', clinicId)
    .gte('created_at', since);

  if (recordings) {
    const totalSeconds = recordings.reduce(
      (sum: number, r: { duration_seconds: number | null }) => sum + (r.duration_seconds ?? 0),
      0,
    );
    audioMinutes = Math.round(totalSeconds / 60);
  }

  return { ai_reports: aiReports, audio_minutes: audioMinutes };
}
