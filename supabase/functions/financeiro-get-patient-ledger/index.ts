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
    const body = await req.json();
    const patientId = String(body.patient_id ?? '');
    if (!patientId) {
      throw new AppError({ code: 'VALIDATION_ERROR', message: 'patient_id obrigatório', statusCode: 400 });
    }

    const supabase = createServiceClient();
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
        .select('*, therapist_schedule:schedule_id(scheduled_at, status, title)')
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    return successResponse(
      {
        patient,
        plan: plan ?? null,
        sessoes_disponiveis: Number(saldo?.sessoes_disponiveis ?? 0),
        transacoes: txs ?? [],
        cobrancas: cobrancas ?? [],
      },
      req,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
