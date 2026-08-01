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
  descricao: z.string().min(1).max(500),
  valor_cents: z.number().int().min(0),
  dia_vencimento: z.number().int().min(1).max(28),
  categoria: z.enum(['CUSTO_FIXO', 'IMPOSTO', 'OUTROS']).default('CUSTO_FIXO'),
  observacoes: z.string().max(2000).optional().nullable(),
  ativo: z.boolean().optional().default(true),
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
      const row = {
        clinic_id: clinicId,
        professional_id: professionalId,
        descricao: p.descricao.trim(),
        categoria: p.categoria,
        valor_cents: p.valor_cents,
        dia_vencimento: p.dia_vencimento,
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

      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (data.ativo) {
        await supabase.rpc('financeiro_gerar_custos_mes', {
          p_clinic_id: clinicId,
          p_year_month: month,
        });
      }

      await supabase.from('audit_logs').insert({
        user_id: user.id,
        clinic_id: clinicId,
        action: p.id ? 'financeiro.custo_update' : 'financeiro.custo_create',
        resource_type: 'financeiro_custos_recorrentes',
        resource_id: data.id,
        metadata: { dia_vencimento: data.dia_vencimento, valor_cents: data.valor_cents },
      });

      return successResponse({ item: data }, req, p.id ? 200 : 201);
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

    const row = {
      clinic_id: clinicId,
      tipo: payload.tipo,
      categoria: payload.categoria,
      descricao: payload.descricao,
      valor_cents: payload.valor_cents,
      status: payload.status,
      data_vencimento: payload.data_vencimento ?? null,
      data_pagamento:
        payload.data_pagamento ??
        (payload.status === 'PAGO' ? new Date().toISOString().slice(0, 10) : null),
      paciente_id: payload.paciente_id ?? null,
      professional_id: professionalId,
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
