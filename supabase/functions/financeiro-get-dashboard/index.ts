import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import {
  assertFinanceAccess,
  getPatientBalance,
  getPatientPlan,
  monthRange,
} from '../_shared/financeiro.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await authenticateRequest(req);
    const clinicId = assertFinanceAccess(user);
    const body = await req.json().catch(() => ({}));
    const now = new Date();
    const month =
      typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month)
        ? body.month
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const range = monthRange(month);
    const supabase = createServiceClient();

    await supabase.rpc('financeiro_promover_sessoes_stale');
    await supabase.rpc('financeiro_gerar_custos_mes', {
      p_clinic_id: clinicId,
      p_year_month: month,
    });

    const { data: txs } = await supabase
      .from('financeiro_transacoes')
      .select('id, tipo, categoria, valor_cents, status, data_pagamento, data_vencimento, paciente_id, descricao')
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .or(
        `and(data_pagamento.gte.${range.start},data_pagamento.lte.${range.end}),and(data_vencimento.gte.${range.start},data_vencimento.lte.${range.end},status.in.(PENDENTE,ATRASADO))`,
      );

    const rows = txs ?? [];
    const receitaRealizada = rows
      .filter((t) => t.tipo === 'ENTRADA' && t.status === 'PAGO')
      .reduce((s, t) => s + Number(t.valor_cents), 0);
    const despesas = rows
      .filter((t) => t.tipo === 'SAIDA' && t.status === 'PAGO')
      .reduce((s, t) => s + Number(t.valor_cents), 0);

    const { data: schedules } = await supabase
      .from('therapist_schedule')
      .select('id, patient_id, scheduled_at, status')
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .gte('scheduled_at', range.startIso)
      .lte('scheduled_at', range.endIso)
      .not('patient_id', 'is', null);

    const patientIds = [...new Set((schedules ?? []).map((s) => s.patient_id).filter(Boolean))] as string[];
    const planMap = new Map<string, { modelo: string; valor_sessao_cents: number; pacote_qtd_sessoes: number | null; pacote_valor_cents: number | null }>();
    if (patientIds.length > 0) {
      const { data: plans } = await supabase
        .from('financeiro_planos_paciente')
        .select('patient_id, modelo, valor_sessao_cents, pacote_qtd_sessoes, pacote_valor_cents')
        .eq('clinic_id', clinicId)
        .in('patient_id', patientIds)
        .is('deleted_at', null);
      (plans ?? []).forEach((p) => planMap.set(p.patient_id, p));
    }

    let receitaProjetada = 0;
    for (const s of schedules ?? []) {
      if (['cancelled', 'canceled', 'no_show'].includes(s.status as string)) continue;
      const plan = planMap.get(s.patient_id as string);
      if (!plan) continue;
      if (plan.modelo === 'pacote' && plan.pacote_qtd_sessoes && plan.pacote_valor_cents) {
        receitaProjetada += Math.round(Number(plan.pacote_valor_cents) / Number(plan.pacote_qtd_sessoes));
      } else {
        receitaProjetada += Number(plan.valor_sessao_cents ?? 0);
      }
    }

    const { data: pendingSessions } = await supabase
      .from('financeiro_sessoes_cobranca')
      .select('id, schedule_id, patient_id, status_cobranca, valor_previsto_cents')
      .eq('clinic_id', clinicId)
      .eq('status_cobranca', 'PENDENTE_CONFIRMACAO')
      .is('deleted_at', null)
      .limit(50);

    const inadimplentesTx = rows.filter((t) => t.tipo === 'ENTRADA' && t.status === 'ATRASADO');
    const pendingTotal = (pendingSessions ?? []).reduce((s, r) => s + Number(r.valor_previsto_cents), 0);

    const { data: dueSoon } = await supabase
      .from('financeiro_transacoes')
      .select('id, descricao, valor_cents, data_vencimento, tipo, status')
      .eq('clinic_id', clinicId)
      .eq('tipo', 'SAIDA')
      .in('status', ['PENDENTE', 'ATRASADO'])
      .is('deleted_at', null)
      .gte('data_vencimento', new Date().toISOString().slice(0, 10))
      .lte(
        'data_vencimento',
        new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      )
      .order('data_vencimento', { ascending: true })
      .limit(20);

    // Tendência 6 meses
    const tendencia: { month: string; receita: number; despesa: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const r = monthRange(key);
      const { data: hist } = await supabase
        .from('financeiro_transacoes')
        .select('tipo, valor_cents, status, data_pagamento')
        .eq('clinic_id', clinicId)
        .eq('status', 'PAGO')
        .is('deleted_at', null)
        .gte('data_pagamento', r.start)
        .lte('data_pagamento', r.end);
      tendencia.push({
        month: key,
        receita: (hist ?? []).filter((t) => t.tipo === 'ENTRADA').reduce((s, t) => s + Number(t.valor_cents), 0),
        despesa: (hist ?? []).filter((t) => t.tipo === 'SAIDA').reduce((s, t) => s + Number(t.valor_cents), 0),
      });
    }

    const pendingItems = [];
    if (body.include_pending_items) {
      const scheduleIds = (pendingSessions ?? []).map((r) => r.schedule_id);
      const pIds = [...new Set((pendingSessions ?? []).map((r) => r.patient_id))];
      const scheduleMap = new Map<string, Record<string, unknown>>();
      const patientMap = new Map<string, string>();
      if (scheduleIds.length > 0) {
        const { data: schedules } = await supabase
          .from('therapist_schedule')
          .select('id, scheduled_at, status, title, duration_minutes')
          .in('id', scheduleIds);
        (schedules ?? []).forEach((s) => scheduleMap.set(s.id, s));
      }
      if (pIds.length > 0) {
        const { data: patients } = await supabase.from('patients').select('id, name').in('id', pIds);
        (patients ?? []).forEach((p) => patientMap.set(p.id, p.name));
      }
      for (const r of pendingSessions ?? []) {
        const plan = await getPatientPlan(r.patient_id, clinicId);
        const saldo = await getPatientBalance(r.patient_id, clinicId);
        pendingItems.push({
          ...r,
          patient_name: patientMap.get(r.patient_id) ?? 'Paciente',
          schedule: scheduleMap.get(r.schedule_id) ?? null,
          modelo: plan?.modelo ?? 'avulso',
          sessoes_disponiveis: saldo,
        });
      }
    }

    return successResponse(
      {
        month,
        receita_projetada_cents: receitaProjetada,
        receita_realizada_cents: receitaRealizada,
        despesas_cents: despesas,
        lucro_liquido_cents: receitaRealizada - despesas,
        tendencia,
        pending_items: pendingItems,
        alertas: {
          sessoes_sem_status: (pendingSessions ?? []).length,
          sessoes_sem_status_total_cents: pendingTotal,
          inadimplentes: inadimplentesTx.length,
          inadimplentes_total_cents: inadimplentesTx.reduce((s, t) => s + Number(t.valor_cents), 0),
          vencimentos_7d: dueSoon ?? [],
        },
      },
      req,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
