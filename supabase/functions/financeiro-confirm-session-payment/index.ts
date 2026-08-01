import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import {
  assertFinanceAccess,
  ensureSessionBillingRow,
  getPatientPlan,
  resolveProfessionalId,
} from '../_shared/financeiro.ts';

const schema = z.object({
  schedule_id: z.string().uuid(),
  action: z.enum(['consumir_pacote', 'receber_avulso', 'cortesia', 'nao_realizado']),
  valor_cents: z.number().int().min(0).optional(),
  forma_pagamento: z.enum(['pix', 'cartao', 'dinheiro', 'outro']).optional(),
});

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await authenticateRequest(req);
    const clinicId = assertFinanceAccess(user);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const p = parsed.data;
    const supabase = createServiceClient();
    const professionalId = await resolveProfessionalId(user, clinicId);

    const { data: session } = await supabase
      .from('therapist_schedule')
      .select('id, patient_id, clinic_id, professional_id, status, scheduled_at')
      .eq('id', p.schedule_id)
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!session?.patient_id) {
      throw new AppError({ code: 'SESSION_NOT_FOUND', message: 'Sessão não encontrada', statusCode: 404 });
    }

    const plan = await getPatientPlan(session.patient_id as string, clinicId);
    let result: Record<string, unknown> = { action: p.action };

    if (p.action === 'consumir_pacote') {
      const { data: novoSaldo, error } = await supabase.rpc('financeiro_consumir_sessao_pacote', {
        p_clinic_id: clinicId,
        p_patient_id: session.patient_id,
        p_schedule_id: session.id,
        p_professional_id: professionalId ?? session.professional_id,
        p_created_by: user.id,
      });
      if (error) {
        throw new AppError({
          code: error.message.includes('NO_PACKAGE_BALANCE') ? 'NO_PACKAGE_BALANCE' : 'CONSUME_FAILED',
          message: error.message.includes('NO_PACKAGE_BALANCE')
            ? 'Paciente sem saldo de pacote'
            : error.message,
          statusCode: 409,
        });
      }
      result = { ...result, sessoes_disponiveis: novoSaldo };
    } else if (p.action === 'receber_avulso') {
      const valor =
        p.valor_cents ??
        Number(plan?.valor_sessao_cents ?? 0);
      const categoria = plan?.modelo === 'social' || valor === 0 ? 'SESSAO_SOCIAL' : 'SESSAO_AVULSA';
      const { data: tx, error } = await supabase
        .from('financeiro_transacoes')
        .insert({
          clinic_id: clinicId,
          tipo: 'ENTRADA',
          categoria,
          descricao: 'Sessão avulsa',
          valor_cents: valor,
          status: 'PAGO',
          data_vencimento: new Date().toISOString().slice(0, 10),
          data_pagamento: new Date().toISOString().slice(0, 10),
          paciente_id: session.patient_id,
          sessao_id: session.id,
          professional_id: professionalId ?? session.professional_id,
          metadata: { forma_pagamento: p.forma_pagamento ?? 'outro' },
          created_by: user.id,
        })
        .select('*')
        .single();
      if (error) {
        throw new AppError({ code: 'TX_FAILED', message: error.message, statusCode: 500 });
      }
      await ensureSessionBillingRow({
        clinicId,
        scheduleId: session.id as string,
        patientId: session.patient_id as string,
        professionalId: (professionalId ?? session.professional_id) as string | null,
        valorPrevistoCents: valor,
        status: valor === 0 ? 'CORTESIA' : 'RECEBIDO_AVULSO',
      });
      await supabase
        .from('financeiro_sessoes_cobranca')
        .update({ transacao_id: tx.id, status_cobranca: valor === 0 ? 'CORTESIA' : 'RECEBIDO_AVULSO' })
        .eq('schedule_id', session.id);
      result = { ...result, transacao: tx };
    } else if (p.action === 'cortesia') {
      await ensureSessionBillingRow({
        clinicId,
        scheduleId: session.id as string,
        patientId: session.patient_id as string,
        professionalId: (professionalId ?? session.professional_id) as string | null,
        valorPrevistoCents: 0,
        status: 'CORTESIA',
      });
      result = { ...result, status_cobranca: 'CORTESIA' };
    } else {
      await ensureSessionBillingRow({
        clinicId,
        scheduleId: session.id as string,
        patientId: session.patient_id as string,
        professionalId: (professionalId ?? session.professional_id) as string | null,
        valorPrevistoCents: Number(plan?.valor_sessao_cents ?? 0),
        status: 'NAO_REALIZADO',
      });
      await supabase
        .from('therapist_schedule')
        .update({ status: 'not_completed' })
        .eq('id', session.id)
        .eq('clinic_id', clinicId);
      result = { ...result, status_cobranca: 'NAO_REALIZADO' };
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      clinic_id: clinicId,
      action: 'financeiro.session_payment',
      resource_type: 'therapist_schedule',
      resource_id: session.id,
      metadata: result,
    });

    return successResponse(result, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
