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
import {
  FinancialContractInputSchema,
  RecurrenceWindowsPayloadSchema,
  getFinancialContract,
  syncRecurrenceWindows,
  upsertFinancialContract,
} from '../_shared/financeiro-contract.ts';

const planSchema = z.object({
  action: z.literal('upsert_plan').optional(),
  patient_id: z.string().uuid(),
  modelo: z.enum(['avulso', 'pacote', 'social']).optional(),
  model_type: z.enum(['PARTICULAR', 'CONVENIO']).optional(),
  billing_type: z.enum(['AVULSO', 'MENSAL_RECORRENTE', 'PACOTE']).optional(),
  valor_acordado_cents: z.number().int().min(0).optional(),
  valor_sessao_cents: z.number().int().min(0).optional(),
  due_day: z.number().int().min(1).max(28).optional().nullable(),
  sessions_per_month: z.number().int().positive().optional().nullable(),
  sessions_custom: z.boolean().optional(),
  contract_duration_months: z.number().int().positive().optional().nullable(),
  contract_starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  pacote_qtd_sessoes: z.number().int().positive().optional().nullable(),
  pacote_valor_cents: z.number().int().min(0).optional().nullable(),
  observacoes: z.string().max(2000).optional().nullable(),
  registrar_pacote_pago: z.boolean().optional().default(false),
});

const getContractSchema = z.object({
  action: z.literal('get_contract'),
  patient_id: z.string().uuid(),
});

const confirmSchema = z.object({
  action: z.literal('confirm_session_payment'),
  schedule_id: z.string().uuid(),
  payment_action: z.enum(['consumir_pacote', 'receber_avulso', 'cortesia', 'nao_realizado']),
  valor_cents: z.number().int().min(0).optional(),
  forma_pagamento: z.enum(['pix', 'cartao', 'dinheiro', 'outro']).optional(),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  competence_month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const rescheduleSchema = z.object({
  action: z.literal('reschedule_from_queue'),
  schedule_id: z.string().uuid(),
  new_start: z.string().datetime(),
});

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await authenticateRequest(req);
    const clinicId = assertFinanceAccess(user);
    const body = await req.json();
    const action = body.action ?? 'upsert_plan';
    const supabase = createServiceClient();
    const professionalId = await resolveProfessionalId(user, clinicId);

    if (action === 'get_contract') {
      const parsed = getContractSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'patient_id inválido',
          statusCode: 400,
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const { data: patient } = await supabase
        .from('patients')
        .select('id, name')
        .eq('id', parsed.data.patient_id)
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)
        .maybeSingle();
      if (!patient) {
        throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
      }
      const detail = await getFinancialContract(parsed.data.patient_id, clinicId);
      return successResponse({ patient, ...detail }, req);
    }

    if (action === 'upsert_windows') {
      const parsed = RecurrenceWindowsPayloadSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'Informe o paciente e ao menos um horário semanal válido',
          statusCode: 400,
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const { data: patient } = await supabase
        .from('patients')
        .select('id, name')
        .eq('id', parsed.data.patient_id)
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)
        .maybeSingle();
      if (!patient) {
        throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
      }
      const result = await syncRecurrenceWindows({
        clinicId,
        createdBy: user.id,
        patientId: parsed.data.patient_id,
        janelas: parsed.data.janelas,
      });
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        clinic_id: clinicId,
        action: 'financeiro.sync_recurrence',
        resource_type: 'financeiro_planos_paciente',
        resource_id: String((result.contract as { id?: string } | null)?.id ?? parsed.data.patient_id),
        metadata: {
          janelas_count: result.janelas_count,
          sync: result.sync,
        },
      });
      return successResponse({ patient, ...result }, req);
    }

    if (action === 'confirm_session_payment') {
      const parsed = confirmSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          statusCode: 400,
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const p = parsed.data;
      const { data: session } = await supabase
        .from('therapist_schedule')
        .select('id, patient_id, clinic_id, professional_id, status')
        .eq('id', p.schedule_id)
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)
        .maybeSingle();
      if (!session?.patient_id) {
        throw new AppError({ code: 'SESSION_NOT_FOUND', message: 'Sessão não encontrada', statusCode: 404 });
      }
      const plan = await getPatientPlan(session.patient_id as string, clinicId);
      let result: Record<string, unknown> = { action: p.payment_action };

      if (p.payment_action === 'consumir_pacote') {
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
      } else if (p.payment_action === 'receber_avulso') {
        const valor = p.valor_cents ?? Number(plan?.valor_sessao_cents ?? 0);
        const categoria = plan?.modelo === 'social' || valor === 0 ? 'SESSAO_SOCIAL' : 'SESSAO_AVULSA';
        const payDate = p.data_pagamento ?? new Date().toISOString().slice(0, 10);
        const competence = p.competence_month ?? `${payDate.slice(0, 7)}-01`;
        const { data: tx, error } = await supabase
          .from('financeiro_transacoes')
          .insert({
            clinic_id: clinicId,
            tipo: 'ENTRADA',
            categoria,
            descricao: 'Sessão avulsa',
            valor_cents: valor,
            status: 'PAGO',
            data_vencimento: payDate,
            data_pagamento: payDate,
            competence_month: competence,
            paciente_id: session.patient_id,
            sessao_id: session.id,
            professional_id: professionalId ?? session.professional_id,
            metadata: { forma_pagamento: p.forma_pagamento ?? 'outro' },
            created_by: user.id,
          })
          .select('*')
          .single();
        if (error) throw new AppError({ code: 'TX_FAILED', message: error.message, statusCode: 500 });
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
          .update({
            transacao_id: tx.id,
            status_cobranca: valor === 0 ? 'CORTESIA' : 'RECEBIDO_AVULSO',
          })
          .eq('schedule_id', session.id);
        result = { ...result, transacao: tx };
      } else if (p.payment_action === 'cortesia') {
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
    }

    if (action === 'reschedule_from_queue') {
      const parsed = rescheduleSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError({ code: 'VALIDATION_ERROR', message: 'Dados inválidos', statusCode: 400 });
      }
      const parsedDate = new Date(parsed.data.new_start);
      if (parsedDate.getTime() < Date.now() - 60_000) {
        throw new AppError({ code: 'PAST_DATE', message: 'Não é possível remarcar no passado', statusCode: 400 });
      }
      const { data: updated, error } = await supabase
        .from('therapist_schedule')
        .update({ scheduled_at: parsedDate.toISOString(), status: 'scheduled' })
        .eq('id', parsed.data.schedule_id)
        .eq('clinic_id', clinicId)
        .select('id, scheduled_at, status, patient_id')
        .single();
      if (error || !updated) {
        throw new AppError({ code: 'UPDATE_FAILED', message: error?.message ?? 'Falha', statusCode: 500 });
      }
      await supabase.from('financeiro_sessoes_cobranca').upsert(
        {
          clinic_id: clinicId,
          schedule_id: parsed.data.schedule_id,
          patient_id: updated.patient_id,
          status_cobranca: 'AGUARDANDO_SESSAO',
          valor_previsto_cents: 0,
          deleted_at: null,
        },
        { onConflict: 'schedule_id' },
      );
      return successResponse({ item: updated }, req);
    }

    const parsed = planSchema.safeParse({ ...body, action: 'upsert_plan' });
    if (!parsed.success) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const p = parsed.data;
    const billingType = p.billing_type
      ?? (p.modelo === 'pacote' ? 'PACOTE' : 'AVULSO');
    const modelType = p.model_type ?? 'PARTICULAR';
    const valor = p.valor_acordado_cents ?? p.valor_sessao_cents ?? p.pacote_valor_cents ?? 0;

    const input = FinancialContractInputSchema.parse({
      patient_id: p.patient_id,
      model_type: modelType,
      billing_type: billingType,
      valor_acordado_cents: valor,
      due_day: p.due_day ?? null,
      sessions_per_month: p.sessions_per_month ?? p.pacote_qtd_sessoes ?? null,
      sessions_custom: p.sessions_custom ?? false,
      contract_duration_months: p.contract_duration_months ?? null,
      contract_starts_on: p.contract_starts_on ?? null,
      observacoes: p.observacoes ?? null,
      pacote_qtd_sessoes: p.pacote_qtd_sessoes ?? null,
      pacote_valor_cents: p.pacote_valor_cents ?? null,
      registrar_pacote_pago: p.registrar_pacote_pago ?? false,
    });

    const result = await upsertFinancialContract({
      clinicId,
      professionalId,
      createdBy: user.id,
      input,
    });

    const { data: saldo } = await supabase
      .from('financeiro_saldos_pacientes')
      .select('sessoes_disponiveis')
      .eq('paciente_id', p.patient_id)
      .maybeSingle();

    return successResponse(
      {
        plan: result.contract,
        contract: result.contract,
        archived_contract_id: result.archived_contract_id,
        needs_windows: result.needs_windows,
        next_step: result.next_step,
        janelas_count: result.janelas_count,
        sessoes_disponiveis: Number(saldo?.sessoes_disponiveis ?? 0),
        package_tx_id: result.package_tx_id,
      },
      req,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
