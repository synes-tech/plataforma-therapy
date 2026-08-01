import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { assertFinanceAccess } from '../_shared/financeiro.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await authenticateRequest(req);
    const clinicId = assertFinanceAccess(user);
    const body = await req.json().catch(() => ({}));
    const supabase = createServiceClient();

    // Ledger individual
    if (typeof body.patient_id === 'string' && body.patient_id) {
      const patientId = body.patient_id as string;
      const { data: patient } = await supabase
        .from('patients')
        .select('id, name')
        .eq('id', patientId)
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)
        .maybeSingle();
      if (!patient) {
        throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
      }

      const [{ data: plan }, { data: saldo }, { data: txs }, { data: cobrancas }] = await Promise.all([
        supabase
          .from('financeiro_planos_paciente')
          .select('*')
          .eq('patient_id', patientId)
          .eq('clinic_id', clinicId)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('financeiro_saldos_pacientes')
          .select('sessoes_disponiveis')
          .eq('paciente_id', patientId)
          .eq('clinic_id', clinicId)
          .is('deleted_at', null)
          .maybeSingle(),
        supabase
          .from('financeiro_transacoes')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('paciente_id', patientId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('financeiro_sessoes_cobranca')
          .select('id, status_cobranca, valor_previsto_cents, schedule_id, created_at')
          .eq('clinic_id', clinicId)
          .eq('patient_id', patientId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      return successResponse(
        {
          mode: 'ledger',
          patient,
          plan: plan ?? null,
          sessoes_disponiveis: Number(saldo?.sessoes_disponiveis ?? 0),
          transacoes: txs ?? [],
          cobrancas: cobrancas ?? [],
        },
        req,
      );
    }

    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, status, status_vinculo')
      .eq('clinic_id', clinicId)
      .eq('status_vinculo', 'ativo')
      .is('deleted_at', null)
      .order('name');

    const ids = (patients ?? []).map((p) => p.id);
    const planMap = new Map<string, Record<string, unknown>>();
    const saldoMap = new Map<string, number>();

    if (ids.length > 0) {
      const [{ data: plans }, { data: saldos }] = await Promise.all([
        supabase
          .from('financeiro_planos_paciente')
          .select('*')
          .eq('clinic_id', clinicId)
          .in('patient_id', ids)
          .is('deleted_at', null),
        supabase
          .from('financeiro_saldos_pacientes')
          .select('paciente_id, sessoes_disponiveis')
          .eq('clinic_id', clinicId)
          .in('paciente_id', ids)
          .is('deleted_at', null),
      ]);
      (plans ?? []).forEach((p) => planMap.set(p.patient_id as string, p));
      (saldos ?? []).forEach((s) => saldoMap.set(s.paciente_id as string, Number(s.sessoes_disponiveis)));
    }

    return successResponse(
      {
        mode: 'list',
        items: (patients ?? []).map((p) => ({
          patient_id: p.id,
          patient_name: p.name,
          plan: planMap.get(p.id) ?? null,
          sessoes_disponiveis: saldoMap.get(p.id) ?? 0,
        })),
      },
      req,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
