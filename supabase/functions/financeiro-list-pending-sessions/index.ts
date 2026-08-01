import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { assertFinanceAccess, getPatientBalance, getPatientPlan } from '../_shared/financeiro.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await authenticateRequest(req);
    const clinicId = assertFinanceAccess(user);
    const supabase = createServiceClient();

    await supabase.rpc('financeiro_promover_sessoes_stale');

    const { data: rows } = await supabase
      .from('financeiro_sessoes_cobranca')
      .select('id, schedule_id, patient_id, professional_id, status_cobranca, valor_previsto_cents, created_at')
      .eq('clinic_id', clinicId)
      .eq('status_cobranca', 'PENDENTE_CONFIRMACAO')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    const scheduleIds = (rows ?? []).map((r) => r.schedule_id);
    const patientIds = [...new Set((rows ?? []).map((r) => r.patient_id))];

    const scheduleMap = new Map<string, Record<string, unknown>>();
    const patientMap = new Map<string, string>();

    if (scheduleIds.length > 0) {
      const { data: schedules } = await supabase
        .from('therapist_schedule')
        .select('id, scheduled_at, status, title, duration_minutes')
        .in('id', scheduleIds);
      (schedules ?? []).forEach((s) => scheduleMap.set(s.id, s));
    }
    if (patientIds.length > 0) {
      const { data: patients } = await supabase.from('patients').select('id, name').in('id', patientIds);
      (patients ?? []).forEach((p) => patientMap.set(p.id, p.name));
    }

    const items = [];
    for (const r of rows ?? []) {
      const plan = await getPatientPlan(r.patient_id, clinicId);
      const saldo = await getPatientBalance(r.patient_id, clinicId);
      items.push({
        ...r,
        patient_name: patientMap.get(r.patient_id) ?? 'Paciente',
        schedule: scheduleMap.get(r.schedule_id) ?? null,
        modelo: plan?.modelo ?? 'avulso',
        sessoes_disponiveis: saldo,
      });
    }

    return successResponse({ items }, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
