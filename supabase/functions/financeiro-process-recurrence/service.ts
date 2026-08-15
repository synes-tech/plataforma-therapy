import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';

interface ClinicRecurrenceResult {
  clinic_id: string;
  ok: boolean;
  competence_month?: string;
  invoices_created?: number;
  sessions_created?: number;
  error?: string;
}

export async function processFinancialRecurrence(yearMonth?: string) {
  if (yearMonth && !/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new AppError({
      code: 'MONTH_INVALID',
      message: 'Competência inválida. Use YYYY-MM.',
      statusCode: 400,
    });
  }

  const supabase = createServiceClient();
  const { data: rows, error: listError } = await supabase
    .from('financeiro_planos_paciente')
    .select('clinic_id')
    .eq('ativo', true)
    .eq('billing_type', 'MENSAL_RECORRENTE')
    .is('deleted_at', null);

  if (listError) {
    throw new AppError({
      code: 'RECURRENCE_CRON_FAILED',
      message: listError.message,
      statusCode: 500,
    });
  }

  const clinics = [...new Set((rows ?? []).map((row) => String(row.clinic_id)).filter(Boolean))];
  const results: ClinicRecurrenceResult[] = [];

  for (const clinicId of clinics) {
    const { data, error } = await supabase.rpc('financeiro_processar_recorrencia_clinica', {
      p_clinic_id: clinicId,
      p_year_month: yearMonth ?? null,
    });
    if (error) {
      results.push({ clinic_id: clinicId, ok: false, error: error.message });
      continue;
    }
    const payload = (data ?? {}) as Record<string, unknown>;
    results.push({
      clinic_id: clinicId,
      ok: true,
      competence_month: typeof payload.competence_month === 'string' ? payload.competence_month : undefined,
      invoices_created: Number(payload.invoices_created ?? 0),
      sessions_created: Number(payload.sessions_created ?? 0),
    });
  }

  const { error: staleError } = await supabase.rpc('financeiro_promover_sessoes_stale');
  const failed = results.filter((item) => !item.ok).length;

  return {
    competence_month: yearMonth ?? null,
    clinics: clinics.length,
    failed,
    invoices_created: results.reduce((sum, item) => sum + (item.invoices_created ?? 0), 0),
    sessions_created: results.reduce((sum, item) => sum + (item.sessions_created ?? 0), 0),
    stale_promoted: !staleError,
    results,
  };
}
