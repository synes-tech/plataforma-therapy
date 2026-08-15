import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { assertFinanceAccess, monthRange } from '../_shared/financeiro.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await authenticateRequest(req);
    const clinicId = assertFinanceAccess(user);
    const body = await req.json().catch(() => ({}));
    const supabase = createServiceClient();

    if (body.mode === 'custos') {
      const now = new Date();
      const month =
        typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month)
          ? body.month
          : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const range = monthRange(month);

      await supabase.rpc('financeiro_gerar_custos_mes', {
        p_clinic_id: clinicId,
        p_year_month: month,
      });

      const competence = `${month}-01`;
      const [{ data: templates }, { data: titulos }] = await Promise.all([
        supabase
          .from('financeiro_custos_recorrentes')
          .select(
            'id, descricao, categoria, kind, valor_cents, dia_vencimento, starts_on, months_total, ends_on, ativo, observacoes, created_at, updated_at',
          )
          .eq('clinic_id', clinicId)
          .is('deleted_at', null)
          .order('dia_vencimento', { ascending: true }),
        supabase
          .from('financeiro_transacoes')
          .select(
            'id, tipo, categoria, descricao, valor_cents, status, data_vencimento, data_pagamento, recorrente, recorrencia_chave, competence_month, installment_current, installment_total, source, metadata, created_at',
          )
          .eq('clinic_id', clinicId)
          .eq('tipo', 'SAIDA')
          .neq('status', 'CANCELADO')
          .is('deleted_at', null)
          .or(
            `competence_month.eq.${competence},and(competence_month.is.null,data_vencimento.gte.${range.start},data_vencimento.lte.${range.end})`,
          )
          .order('data_vencimento', { ascending: true }),
      ]);

      const items = (titulos ?? []).map((t) => ({
        ...t,
        parcela_label:
          t.installment_current && t.installment_total
            ? `${t.installment_current}/${t.installment_total}`
            : null,
      }));
      const sum = (status: string) =>
        items.filter((t) => t.status === status).reduce((acc, t) => acc + Number(t.valor_cents), 0);
      const count = (status: string) => items.filter((t) => t.status === status).length;

      return successResponse(
        {
          mode: 'custos',
          month,
          templates: templates ?? [],
          titulos_mes: items,
          summary: {
            a_pagar_cents: sum('PENDENTE'),
            atrasado_cents: sum('ATRASADO'),
            pago_cents: sum('PAGO'),
            count_a_pagar: count('PENDENTE'),
            count_atrasado: count('ATRASADO'),
            count_pago: count('PAGO'),
          },
        },
        req,
      );
    }

    if (body.mode === 'receivables') {
      const now = new Date();
      const month =
        typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month)
          ? body.month
          : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const range = monthRange(month);
      const competence = `${month}-01`;

      await supabase.rpc('financeiro_promover_recebiveis_atrasados', { p_clinic_id: clinicId });

      let query = supabase
        .from('financeiro_transacoes')
        .select(
          'id, tipo, categoria, descricao, valor_cents, status, data_vencimento, data_pagamento, paciente_id, sessao_id, professional_id, contract_id, competence_month, source, metadata, created_at',
        )
        .eq('clinic_id', clinicId)
        .eq('tipo', 'ENTRADA')
        .neq('status', 'CANCELADO')
        .is('deleted_at', null)
        .or(
          `competence_month.eq.${competence},and(competence_month.is.null,data_vencimento.gte.${range.start},data_vencimento.lte.${range.end}),and(competence_month.is.null,data_pagamento.gte.${range.start},data_pagamento.lte.${range.end})`,
        )
        .order('data_vencimento', { ascending: true, nullsFirst: false })
        .limit(300);

      if (typeof body.paciente_id === 'string' && body.paciente_id) {
        query = query.eq('paciente_id', body.paciente_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = data ?? [];
      const patientIds = [...new Set(rows.map((t) => t.paciente_id).filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (patientIds.length > 0) {
        const { data: patients } = await supabase.from('patients').select('id, name').in('id', patientIds);
        (patients ?? []).forEach((p) => names.set(p.id, p.name));
      }

      const items = rows.map((t) => ({
        ...t,
        paciente_nome: t.paciente_id ? names.get(t.paciente_id) ?? null : null,
      }));

      const statusFilter = typeof body.status === 'string' ? body.status : '';
      const filtered = statusFilter ? items.filter((t) => t.status === statusFilter) : items;

      const sum = (status: string) =>
        items.filter((t) => t.status === status).reduce((acc, t) => acc + Number(t.valor_cents), 0);
      const count = (status: string) => items.filter((t) => t.status === status).length;

      return successResponse(
        {
          mode: 'receivables',
          month,
          items: filtered,
          summary: {
            a_receber_cents: sum('PENDENTE'),
            atrasado_cents: sum('ATRASADO'),
            pago_cents: sum('PAGO'),
            count_a_receber: count('PENDENTE'),
            count_atrasado: count('ATRASADO'),
            count_pago: count('PAGO'),
          },
        },
        req,
      );
    }

    let query = supabase
      .from('financeiro_transacoes')
      .select(
        'id, tipo, categoria, descricao, valor_cents, status, data_vencimento, data_pagamento, paciente_id, sessao_id, professional_id, contract_id, competence_month, source, recorrente, created_at',
      )
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);

    if (typeof body.tipo === 'string') query = query.eq('tipo', body.tipo);
    if (typeof body.status === 'string') query = query.eq('status', body.status);
    if (typeof body.paciente_id === 'string') query = query.eq('paciente_id', body.paciente_id);
    if (typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month)) {
      const r = monthRange(body.month);
      query = query.or(
        `and(data_pagamento.gte.${r.start},data_pagamento.lte.${r.end}),and(data_vencimento.gte.${r.start},data_vencimento.lte.${r.end})`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const patientIds = [...new Set((data ?? []).map((t) => t.paciente_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (patientIds.length > 0) {
      const { data: patients } = await supabase.from('patients').select('id, name').in('id', patientIds);
      (patients ?? []).forEach((p) => names.set(p.id, p.name));
    }

    return successResponse(
      {
        items: (data ?? []).map((t) => ({
          ...t,
          paciente_nome: t.paciente_id ? names.get(t.paciente_id) ?? null : null,
        })),
      },
      req,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
