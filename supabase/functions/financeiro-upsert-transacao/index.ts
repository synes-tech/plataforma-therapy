import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { assertFinanceAccess, resolveProfessionalId } from '../_shared/financeiro.ts';

const txSchema = z.object({
  action: z.literal('upsert_tx').optional(),
  id: z.string().uuid().optional(),
  tipo: z.enum(['ENTRADA', 'SAIDA']),
  categoria: z.enum([
    'SESSAO_AVULSA',
    'PACOTE',
    'SESSAO_SOCIAL',
    'RENDIMENTO_EXTRA',
    'CUSTO_FIXO',
    'CUSTO_VARIAVEL',
    'IMPOSTO',
    'REPASSE_PROFISSIONAL',
    'OUTROS',
  ]),
  descricao: z.string().max(500).default(''),
  valor_cents: z.number().int().min(0),
  status: z.enum(['PAGO', 'PENDENTE', 'ATRASADO', 'CANCELADO']).default('PAGO'),
  data_vencimento: z.string().optional().nullable(),
  data_pagamento: z.string().optional().nullable(),
  paciente_id: z.string().uuid().optional().nullable(),
  recorrente: z.boolean().optional().default(false),
  metadata: z.record(z.unknown()).optional(),
});

const custoSchema = z.object({
  action: z.literal('upsert_custo_recorrente'),
  id: z.string().uuid().optional(),
  kind: z.enum(['FIXA', 'VARIAVEL_PARCELADA', 'PONTUAL']).optional().default('FIXA'),
  descricao: z.string().min(1).max(500),
  valor_cents: z.number().int().min(0),
  dia_vencimento: z.number().int().min(1).max(28).optional(),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  months_total: z.number().int().min(1).max(60).optional().nullable(),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  is_already_paid: z.boolean().optional().default(false),
  categoria: z.enum([
    'CUSTO_FIXO',
    'CUSTO_VARIAVEL',
    'IMPOSTO',
    'DESPESA_PARCELADA',
    'DESPESA_PONTUAL',
    'OUTROS',
  ]).optional(),
  observacoes: z.string().max(2000).optional().nullable(),
  ativo: z.boolean().optional().default(true),
});

const baixarDespesaSchema = z.object({
  action: z.literal('baixar_despesa'),
  id: z.string().uuid(),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  forma_pagamento: z.enum(['pix', 'cartao', 'dinheiro', 'boleto', 'outro']).optional(),
});

const toggleSchema = z.object({
  action: z.literal('toggle_custo'),
  id: z.string().uuid(),
  ativo: z.boolean(),
});

const marcarPagoSchema = z.object({
  action: z.literal('marcar_pago'),
  id: z.string().uuid(),
  data_pagamento: z.string().optional().nullable(),
});

const baixarRecebivelSchema = z.object({
  action: z.literal('baixar_recebivel'),
  id: z.string().uuid(),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  forma_pagamento: z.enum(['pix', 'cartao', 'dinheiro', 'outro']).optional(),
  valor_cents: z.number().int().min(0).optional(),
});

const sessaoAvulsaSchema = z.object({
  action: z.literal('registrar_sessao_avulsa'),
  patient_id: z.string().uuid(),
  valor_cents: z.number().int().min(0),
  is_already_paid: z.boolean().optional().default(false),
  descricao: z.string().max(500).optional().nullable(),
  occurred_at: z.string().min(10).max(40).optional().nullable(),
  schedule_id: z.string().uuid().optional().nullable(),
  forma_pagamento: z.enum(['pix', 'cartao', 'dinheiro', 'outro']).optional(),
});

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await authenticateRequest(req);
    const clinicId = assertFinanceAccess(user);
    const body = await req.json();
    const action = body.action ?? 'upsert_tx';
    const supabase = createServiceClient();
    const professionalId = await resolveProfessionalId(user, clinicId);

    if (action === 'upsert_custo_recorrente') {
      const parsed = custoSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          statusCode: 400,
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const p = parsed.data;
      const kind = p.kind ?? 'FIXA';

      if (kind === 'PONTUAL' && !p.id) {
        const due = p.data_vencimento ?? new Date().toISOString().slice(0, 10);
        const paid = Boolean(p.is_already_paid);
        const competence = `${due.slice(0, 7)}-01`;
        const inserted = await supabase
          .from('financeiro_transacoes')
          .insert({
            clinic_id: clinicId,
            tipo: 'SAIDA',
            categoria: p.categoria ?? 'DESPESA_PONTUAL',
            descricao: p.descricao.trim(),
            valor_cents: p.valor_cents,
            data_vencimento: due,
            data_pagamento: paid ? due : null,
            status: paid ? 'PAGO' : (due < new Date().toISOString().slice(0, 10) ? 'ATRASADO' : 'PENDENTE'),
            professional_id: professionalId,
            competence_month: competence,
            source: 'expense_oneoff',
            metadata: { observacoes: p.observacoes ?? null },
            created_by: user.id,
          })
          .select('*')
          .single();
        if (inserted.error) {
          throw new AppError({ code: 'CREATE_FAILED', message: inserted.error.message, statusCode: 500 });
        }
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          clinic_id: clinicId,
          action: 'financeiro.despesa_pontual_create',
          resource_type: 'financeiro_transacoes',
          resource_id: inserted.data.id,
          metadata: { valor_cents: p.valor_cents, paid },
        });
        return successResponse({ item: inserted.data, kind: 'PONTUAL' }, req, 201);
      }

      if (kind === 'VARIAVEL_PARCELADA' && !p.id) {
        if (!p.starts_on || !p.months_total) {
          throw new AppError({
            code: 'VALIDATION_ERROR',
            message: 'Parcelamento exige mês de início e quantidade de parcelas (1 a 60).',
            statusCode: 400,
          });
        }
      }

      const dueDay = Math.min(28, Math.max(1, p.dia_vencimento ?? 10));
      const categoria = p.categoria
        ?? (kind === 'VARIAVEL_PARCELADA' ? 'DESPESA_PARCELADA' : 'CUSTO_FIXO');
      const row = {
        clinic_id: clinicId,
        professional_id: professionalId,
        kind,
        descricao: p.descricao.trim(),
        categoria,
        valor_cents: p.valor_cents,
        dia_vencimento: dueDay,
        starts_on: kind === 'VARIAVEL_PARCELADA' ? p.starts_on : null,
        months_total: kind === 'VARIAVEL_PARCELADA' ? p.months_total : null,
        ativo: p.ativo ?? true,
        observacoes: p.observacoes ?? null,
        created_by: user.id,
        deleted_at: null,
      };

      let data;
      if (p.id) {
        const res = await supabase
          .from('financeiro_custos_recorrentes')
          .update({
            descricao: row.descricao,
            categoria: row.categoria,
            valor_cents: row.valor_cents,
            dia_vencimento: row.dia_vencimento,
            ativo: row.ativo,
            observacoes: row.observacoes,
          })
          .eq('id', p.id)
          .eq('clinic_id', clinicId)
          .is('deleted_at', null)
          .select('*')
          .single();
        if (res.error) {
          throw new AppError({ code: 'UPDATE_FAILED', message: res.error.message, statusCode: 500 });
        }
        data = res.data;
      } else {
        const res = await supabase.from('financeiro_custos_recorrentes').insert(row).select('*').single();
        if (res.error) {
          throw new AppError({ code: 'CREATE_FAILED', message: res.error.message, statusCode: 500 });
        }
        data = res.data;
      }

      let parcelamento: Record<string, unknown> | null = null;
      if (!p.id && kind === 'VARIAVEL_PARCELADA') {
        const { data: sync, error: rpcErr } = await supabase.rpc('financeiro_gerar_despesa_parcelada', {
          p_custo_id: data.id,
        });
        if (rpcErr) {
          throw new AppError({ code: 'INSTALLMENT_FAILED', message: rpcErr.message, statusCode: 500 });
        }
        parcelamento = sync as Record<string, unknown>;
      } else {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (data.ativo) {
          await supabase.rpc('financeiro_gerar_custos_mes', {
            p_clinic_id: clinicId,
            p_year_month: month,
          });
        }
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        clinic_id: clinicId,
        action: p.id ? 'financeiro.custo_update' : 'financeiro.custo_create',
        resource_type: 'financeiro_custos_recorrentes',
        resource_id: data.id,
        metadata: { kind, valor_cents: data.valor_cents, months_total: data.months_total ?? null },
      });

      return successResponse({ item: data, kind, parcelamento }, req, p.id ? 200 : 201);
    }

    if (action === 'baixar_despesa') {
      const parsed = baixarDespesaSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError({ code: 'VALIDATION_ERROR', message: 'Dados inválidos', statusCode: 400 });
      }
      const payDate = parsed.data.data_pagamento ?? new Date().toISOString().slice(0, 10);
      const { data: txId, error } = await supabase.rpc('financeiro_baixar_despesa', {
        p_clinic_id: clinicId,
        p_tx_id: parsed.data.id,
        p_paid_date: payDate,
        p_forma_pagamento: parsed.data.forma_pagamento ?? null,
      });
      if (error) {
        throw new AppError({
          code: error.message.includes('TX_NOT_PAYABLE') ? 'TX_NOT_PAYABLE' : 'PAY_FAILED',
          message: error.message.includes('TX_NOT_PAYABLE')
            ? 'Esta despesa já foi paga ou não pode receber baixa.'
            : error.message,
          statusCode: error.message.includes('TX_NOT_PAYABLE') ? 400 : 500,
        });
      }
      const { data: item } = await supabase
        .from('financeiro_transacoes')
        .select('*')
        .eq('id', txId)
        .eq('clinic_id', clinicId)
        .maybeSingle();
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        clinic_id: clinicId,
        action: 'financeiro.baixar_despesa',
        resource_type: 'financeiro_transacoes',
        resource_id: parsed.data.id,
        metadata: { data_pagamento: payDate, forma_pagamento: parsed.data.forma_pagamento ?? null },
      });
      return successResponse({ item, transaction_id: txId }, req);
    }

    if (action === 'toggle_custo') {
      const parsed = toggleSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError({ code: 'VALIDATION_ERROR', message: 'Dados inválidos', statusCode: 400 });
      }
      const { data, error } = await supabase
        .from('financeiro_custos_recorrentes')
        .update({ ativo: parsed.data.ativo })
        .eq('id', parsed.data.id)
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)
        .select('*')
        .single();
      if (error || !data) {
        throw new AppError({ code: 'UPDATE_FAILED', message: error?.message ?? 'Não encontrado', statusCode: 404 });
      }
      if (data.ativo) {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        await supabase.rpc('financeiro_gerar_custos_mes', {
          p_clinic_id: clinicId,
          p_year_month: month,
        });
      }
      return successResponse({ item: data }, req);
    }

    if (action === 'baixar_recebivel') {
      const parsed = baixarRecebivelSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError({ code: 'VALIDATION_ERROR', message: 'Dados inválidos', statusCode: 400 });
      }
      const payDate = parsed.data.data_pagamento ?? new Date().toISOString().slice(0, 10);
      const { data: txId, error } = await supabase.rpc('financeiro_baixar_transacao', {
        p_clinic_id: clinicId,
        p_tx_id: parsed.data.id,
        p_paid_date: payDate,
        p_forma_pagamento: parsed.data.forma_pagamento ?? null,
      });
      if (error) {
        throw new AppError({
          code: error.message.includes('TX_NOT_PAYABLE') ? 'TX_NOT_PAYABLE' : 'PAY_FAILED',
          message: error.message.includes('TX_NOT_PAYABLE')
            ? 'Este título já foi pago ou não pode receber baixa.'
            : error.message,
          statusCode: error.message.includes('TX_NOT_PAYABLE') ? 400 : 500,
        });
      }
      if (typeof parsed.data.valor_cents === 'number') {
        const { error: valorError } = await supabase
          .from('financeiro_transacoes')
          .update({ valor_cents: parsed.data.valor_cents })
          .eq('id', txId)
          .eq('clinic_id', clinicId)
          .eq('tipo', 'ENTRADA');
        if (valorError) {
          throw new AppError({ code: 'PAY_FAILED', message: valorError.message, statusCode: 500 });
        }
      }
      const { data: item } = await supabase
        .from('financeiro_transacoes')
        .select('*')
        .eq('id', txId)
        .eq('clinic_id', clinicId)
        .maybeSingle();
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        clinic_id: clinicId,
        action: 'financeiro.baixar_recebivel',
        resource_type: 'financeiro_transacoes',
        resource_id: parsed.data.id,
        metadata: {
          data_pagamento: payDate,
          forma_pagamento: parsed.data.forma_pagamento ?? null,
          valor_cents: parsed.data.valor_cents ?? item?.valor_cents ?? null,
        },
      });
      return successResponse({ item, transaction_id: txId }, req);
    }

    if (action === 'registrar_sessao_avulsa') {
      const parsed = sessaoAvulsaSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError({
          code: 'VALIDATION_ERROR',
          message: 'Informe o paciente e o valor da sessão',
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
      const { data: txId, error } = await supabase.rpc('financeiro_registrar_sessao_avulsa', {
        p_clinic_id: clinicId,
        p_patient_id: parsed.data.patient_id,
        p_professional_id: professionalId,
        p_valor_cents: parsed.data.valor_cents,
        p_schedule_id: parsed.data.schedule_id ?? null,
        p_paid: parsed.data.is_already_paid ?? false,
        p_created_by: user.id,
        p_descricao: parsed.data.descricao ?? null,
        p_occurred_at: parsed.data.occurred_at ?? null,
      });
      if (error) {
        const notFound = error.message.includes('PATIENT_NOT_FOUND');
        throw new AppError({
          code: notFound ? 'PATIENT_NOT_FOUND' : 'SESSION_TX_FAILED',
          message: notFound ? 'Paciente não encontrado' : error.message,
          statusCode: notFound ? 404 : 500,
        });
      }
      if (parsed.data.forma_pagamento && txId) {
        const { data: current } = await supabase
          .from('financeiro_transacoes')
          .select('metadata')
          .eq('id', txId)
          .eq('clinic_id', clinicId)
          .maybeSingle();
        await supabase
          .from('financeiro_transacoes')
          .update({
            metadata: {
              ...((current?.metadata as Record<string, unknown> | null) ?? {}),
              forma_pagamento: parsed.data.forma_pagamento,
            },
          })
          .eq('id', txId)
          .eq('clinic_id', clinicId);
      }
      const { data: item } = await supabase
        .from('financeiro_transacoes')
        .select('*')
        .eq('id', txId)
        .eq('clinic_id', clinicId)
        .maybeSingle();
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        clinic_id: clinicId,
        action: 'financeiro.registrar_sessao_avulsa',
        resource_type: 'financeiro_transacoes',
        resource_id: txId as string,
        metadata: {
          patient_id: parsed.data.patient_id,
          valor_cents: parsed.data.valor_cents,
          is_already_paid: parsed.data.is_already_paid ?? false,
        },
      });
      return successResponse({ item, transaction_id: txId, patient }, req, 201);
    }

    if (action === 'marcar_pago') {
      const parsed = marcarPagoSchema.safeParse(body);
      if (!parsed.success) {
        throw new AppError({ code: 'VALIDATION_ERROR', message: 'Dados inválidos', statusCode: 400 });
      }
      const payDate = parsed.data.data_pagamento ?? new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('financeiro_transacoes')
        .update({
          status: 'PAGO',
          data_pagamento: payDate,
        })
        .eq('id', parsed.data.id)
        .eq('clinic_id', clinicId)
        .eq('tipo', 'SAIDA')
        .is('deleted_at', null)
        .in('status', ['PENDENTE', 'ATRASADO'])
        .select('*')
        .single();
      if (error || !data) {
        throw new AppError({
          code: 'UPDATE_FAILED',
          message: error?.message ?? 'Título não encontrado ou já pago',
          statusCode: 404,
        });
      }
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        clinic_id: clinicId,
        action: 'financeiro.custo_marcar_pago',
        resource_type: 'financeiro_transacoes',
        resource_id: data.id,
        metadata: { valor_cents: data.valor_cents, data_pagamento: payDate },
      });
      return successResponse({ item: data }, req);
    }

    const parsed = txSchema.safeParse({ ...body, action: 'upsert_tx' });
    if (!parsed.success) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const payload = parsed.data;

    const due = payload.data_vencimento ?? new Date().toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    let status = payload.status;
    if (status === 'PENDENTE' && due < today) status = 'ATRASADO';
    const row = {
      clinic_id: clinicId,
      tipo: payload.tipo,
      categoria: payload.categoria,
      descricao: payload.descricao,
      valor_cents: payload.valor_cents,
      status,
      data_vencimento: due,
      data_pagamento:
        payload.data_pagamento ??
        (status === 'PAGO' ? today : null),
      paciente_id: payload.paciente_id ?? null,
      professional_id: professionalId,
      competence_month: `${due.slice(0, 7)}-01`,
      source: payload.tipo === 'ENTRADA' ? 'manual_income' : 'manual_expense',
      recorrente: payload.recorrente ?? false,
      metadata: payload.metadata ?? {},
      created_by: user.id,
      deleted_at: null,
    };

    let data;
    if (payload.id) {
      const res = await supabase
        .from('financeiro_transacoes')
        .update(row)
        .eq('id', payload.id)
        .eq('clinic_id', clinicId)
        .select('*')
        .single();
      if (res.error) throw new AppError({ code: 'UPDATE_FAILED', message: res.error.message, statusCode: 500 });
      data = res.data;
    } else {
      const res = await supabase.from('financeiro_transacoes').insert(row).select('*').single();
      if (res.error) throw new AppError({ code: 'CREATE_FAILED', message: res.error.message, statusCode: 500 });
      data = res.data;
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      clinic_id: clinicId,
      action: payload.id ? 'financeiro.tx_update' : 'financeiro.tx_create',
      resource_type: 'financeiro_transacoes',
      resource_id: data.id,
      metadata: { tipo: data.tipo, valor_cents: data.valor_cents },
    });

    return successResponse({ item: data }, req, payload.id ? 200 : 201);
  } catch (error) {
    return errorResponse(error, req);
  }
});
