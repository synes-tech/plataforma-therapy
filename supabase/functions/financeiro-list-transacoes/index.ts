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

      const [{ data: templates }, { data: titulos }] = await Promise.all([
        supabase
          .from('financeiro_custos_recorrentes')
          .select(
            'id, descricao, categoria, valor_cents, dia_vencimento, ativo, observacoes, created_at, updated_at',
          )
          .eq('clinic_id', clinicId)
          .is('deleted_at', null)
          .order('dia_vencimento', { ascending: true }),
        supabase
          .from('financeiro_transacoes')
          .select(
            'id, tipo, categoria, descricao, valor_cents, status, data_vencimento, data_pagamento, recorrente, recorrencia_chave, metadata, created_at',
          )
          .eq('clinic_id', clinicId)
          .eq('tipo', 'SAIDA')
          .eq('recorrente', true)
          .is('deleted_at', null)
          .gte('data_vencimento', range.start)
          .lte('data_vencimento', range.end)
          .order('data_vencimento', { ascending: true }),
      ]);

      return successResponse(
        {
          mode: 'custos',
          month,
          templates: templates ?? [],
          titulos_mes: titulos ?? [],
        },
        req,
      );
    }

    let query = supabase
      .from('financeiro_transacoes')
      .select(
        'id, tipo, categoria, descricao, valor_cents, status, data_vencimento, data_pagamento, paciente_id, sessao_id, professional_id, recorrente, created_at',
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
