import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { compareClinicalAlerts } from '../_shared/companion/alerts.ts';
import type { ListClinicalAlertsPayload } from './schema.ts';
import type { ClinicalAlertItem, ListClinicalAlertsResponse } from './types.ts';

interface AlertRow {
  id: string;
  patient_id: string;
  clinic_id: string;
  professional_id: string | null;
  source: string;
  severity: ClinicalAlertItem['severity'];
  status: ClinicalAlertItem['status'];
  title: string;
  summary: string;
  source_ref_id: string | null;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
  patients: { name: string; foto_url: string | null } | { name: string; foto_url: string | null }[] | null;
}

function patientFields(row: AlertRow): { name: string; foto_url: string | null } {
  const linked = row.patients;
  const first = Array.isArray(linked) ? linked[0] : linked;
  return { name: first?.name ?? 'Paciente', foto_url: first?.foto_url ?? null };
}

export async function listClinicalAlerts(
  caller: AuthenticatedUser,
  payload: ListClinicalAlertsPayload,
): Promise<ListClinicalAlertsResponse> {
  const supabase = createServiceClient();
  const status = payload.status ?? 'UNREAD';
  const limit = payload.limit ?? 40;

  let query = supabase
    .from('clinical_alerts')
    .select('id, patient_id, clinic_id, professional_id, source, severity, status, title, summary, source_ref_id, occurred_at, metadata, patients(name, foto_url)')
    .eq('status', status)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (caller.role === 'professional') {
    const { data: professional } = await supabase
      .from('professionals')
      .select('id, clinic_id')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!professional) {
      throw new ForbiddenError('Profissional não encontrado');
    }
    query = query.eq('professional_id', professional.id);
  } else if (caller.role === 'clinic_admin') {
    if (!caller.clinic_id) {
      throw new AppError({ code: 'NO_CLINIC', message: 'Conta sem clínica vinculada', statusCode: 400 });
    }
    query = query.eq('clinic_id', caller.clinic_id);
  } else if (caller.role !== 'master') {
    throw new ForbiddenError('Sem permissão para triagem clínica');
  }

  const { data, error } = await query;
  if (error) {
    throw new AppError({ code: 'ALERTS_READ_FAILED', message: error.message, statusCode: 500 });
  }

  const alerts = ((data ?? []) as AlertRow[])
    .map((row) => {
      const patient = patientFields(row);
      return {
        id: row.id,
        patient_id: row.patient_id,
        patient_name: patient.name,
        patient_foto_url: patient.foto_url,
        clinic_id: row.clinic_id,
        professional_id: row.professional_id,
        source: row.source,
        severity: row.severity,
        status: row.status,
        title: row.title,
        summary: row.summary,
        source_ref_id: row.source_ref_id,
        occurred_at: row.occurred_at,
        notify_now: Boolean(row.metadata?.notify_now) || row.severity === 'SEVERE',
        metadata: row.metadata ?? {},
      };
    })
    .sort(compareClinicalAlerts);

  const unreadCount = status === 'UNREAD' ? alerts.length : alerts.filter((item) => item.status === 'UNREAD').length;
  const severeUnreadCount = alerts.filter((item) => item.status === 'UNREAD' && item.severity === 'SEVERE').length;

  return {
    alerts,
    unread_count: unreadCount,
    severe_unread_count: severeUnreadCount,
    has_severe_unread: severeUnreadCount > 0,
  };
}
