#!/usr/bin/env node
/**
 * QA — ERP Financeiro Caixa (MVP Core)
 *
 * Uso: node --env-file=.env scripts/qa-financeiro-caixa.mjs
 *
 * Cenários:
 *  1 Schema + RPCs
 *  2 Pacote 4 → consumir → saldo 3
 *  3 Avulso → ENTRADA no extrato
 *  4 Empregado (não-solo) → 403 FINANCE_FORBIDDEN
 *  5 Isolamento tenant (clinic A ≠ clinic B)
 *  6 Dashboard responde 200 para owner solo
 */
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB = process.env.DATABASE_URL;

let passed = 0;
let failed = 0;
const cleanup = { patientIds: [], scheduleIds: [], txIds: [] };

function check(label, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function callFn(fn, token, body) {
  const res = await fetch(`${URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON,
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function tokenForUser(admin, anon, userId) {
  const pw = `QaFin-${Date.now()}!`;
  await admin.auth.admin.updateUserById(userId, { password: pw });
  const { data: user } = await admin.auth.admin.getUserById(userId);
  const email = user.user?.email;
  const cli = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await cli.auth.signInWithPassword({ email, password: pw });
  if (error) throw error;
  return data.session.access_token;
}

async function main() {
  if (!URL || !ANON || !SERVICE || !DB) {
    console.error('Defina SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL');
    process.exit(1);
  }

  const db = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const admin = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const TS = Date.now();

  console.log('\n═══ 1. Schema ═══');
  const tables = await db.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'financeiro_planos_paciente','financeiro_transacoes',
        'financeiro_saldos_pacientes','financeiro_sessoes_cobranca'
      )`);
  const tset = new Set(tables.rows.map((r) => r.table_name));
  check('tabela financeiro_planos_paciente', tset.has('financeiro_planos_paciente'));
  check('tabela financeiro_transacoes', tset.has('financeiro_transacoes'));
  check('tabela financeiro_saldos_pacientes', tset.has('financeiro_saldos_pacientes'));
  check('tabela financeiro_sessoes_cobranca', tset.has('financeiro_sessoes_cobranca'));

  const rpcs = await db.query(`
    SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND proname IN (
        'financeiro_vender_pacote','financeiro_consumir_sessao_pacote','financeiro_promover_sessoes_stale','is_finance_owner'
      )`);
  const rset = new Set(rpcs.rows.map((r) => r.proname));
  check('RPC financeiro_vender_pacote', rset.has('financeiro_vender_pacote'));
  check('RPC financeiro_consumir_sessao_pacote', rset.has('financeiro_consumir_sessao_pacote'));
  check('RPC financeiro_promover_sessoes_stale', rset.has('financeiro_promover_sessoes_stale'));
  check('helper is_finance_owner', rset.has('is_finance_owner'));

  console.log('\n═══ 2. Owner solo + pacote/consumo ═══');
  const soloRes = await db.query(`
    SELECT prof.id AS prof_id, prof.clinic_id, prof.user_id, u.email,
           COALESCE((u.raw_app_meta_data->>'is_solo')::boolean, false) AS is_solo
    FROM professionals prof
    JOIN auth.users u ON u.id = prof.user_id
    WHERE prof.deleted_at IS NULL
      AND (u.raw_app_meta_data->>'role') = 'professional'
      AND COALESCE((u.raw_app_meta_data->>'is_solo')::boolean, false) = true
    ORDER BY u.email
    LIMIT 1`);
  if (soloRes.rows.length === 0) {
    console.log('  ⚠️  Nenhum professional solo — pulando testes de API owner');
  } else {
    const solo = soloRes.rows[0];
    console.log(`  Owner: ${solo.email}`);
    const token = await tokenForUser(admin, ANON, solo.user_id);

    const dash = await callFn('financeiro-get-dashboard', token, {
      month: new Date().toISOString().slice(0, 7),
      include_pending_items: true,
    });
    check('dashboard 200', dash.status === 200, `status=${dash.status}`);

    const patientIns = await db.query(
      `INSERT INTO patients (clinic_id, professional_id, name, birth_date, created_by, status, status_vinculo)
       VALUES ($1, $2, $3, '2010-01-01', $4, 'active', 'ativo')
       RETURNING id`,
      [solo.clinic_id, solo.prof_id, `QA Fin ${TS}`, solo.user_id],
    );
    const patientId = patientIns.rows[0].id;
    cleanup.patientIds.push(patientId);

    const upsertPlan = await callFn('financeiro-upsert-patient-plan', token, {
      patient_id: patientId,
      modelo: 'pacote',
      valor_sessao_cents: 15000,
      pacote_qtd_sessoes: 4,
      pacote_valor_cents: 50000,
      registrar_pacote_pago: true,
    });
    check('venda pacote 200', upsertPlan.status === 200, `status=${upsertPlan.status} ${JSON.stringify(upsertPlan.json?.error ?? '')}`);

    const saldo1 = await db.query(
      `SELECT sessoes_disponiveis FROM financeiro_saldos_pacientes
       WHERE paciente_id = $1 AND deleted_at IS NULL`,
      [patientId],
    );
    check('saldo após pacote = 4', Number(saldo1.rows[0]?.sessoes_disponiveis) === 4, String(saldo1.rows[0]?.sessoes_disponiveis));

    const past = new Date(Date.now() - 3600_000).toISOString();
    const sched = await db.query(
      `INSERT INTO therapist_schedule
         (clinic_id, professional_id, patient_id, scheduled_at, duration_minutes, status, title)
       VALUES ($1, $2, $3, $4, 50, 'completed', 'QA sessão')
       RETURNING id`,
      [solo.clinic_id, solo.prof_id, patientId, past],
    );
    const scheduleId = sched.rows[0].id;
    cleanup.scheduleIds.push(scheduleId);

    const consume = await callFn('financeiro-upsert-patient-plan', token, {
      action: 'confirm_session_payment',
      schedule_id: scheduleId,
      payment_action: 'consumir_pacote',
    });
    check('consumir pacote 200', consume.status === 200, `status=${consume.status} ${JSON.stringify(consume.json?.error ?? '')}`);

    const saldo2 = await db.query(
      `SELECT sessoes_disponiveis FROM financeiro_saldos_pacientes
       WHERE paciente_id = $1 AND deleted_at IS NULL`,
      [patientId],
    );
    check('saldo após consumo = 3', Number(saldo2.rows[0]?.sessoes_disponiveis) === 3, String(saldo2.rows[0]?.sessoes_disponiveis));

    const entradasPacote = await db.query(
      `SELECT count(*)::int AS n FROM financeiro_transacoes
       WHERE paciente_id = $1 AND categoria = 'PACOTE' AND status = 'PAGO' AND deleted_at IS NULL`,
      [patientId],
    );
    check('1 ENTRADA PACOTE (sem nova ao consumir)', entradasPacote.rows[0].n === 1);

    console.log('\n═══ 3. Avulso ═══');
    const patientAvulso = await db.query(
      `INSERT INTO patients (clinic_id, professional_id, name, birth_date, created_by, status, status_vinculo)
       VALUES ($1, $2, $3, '2012-05-05', $4, 'active', 'ativo')
       RETURNING id`,
      [solo.clinic_id, solo.prof_id, `QA Avulso ${TS}`, solo.user_id],
    );
    const avulsoId = patientAvulso.rows[0].id;
    cleanup.patientIds.push(avulsoId);

    await callFn('financeiro-upsert-patient-plan', token, {
      patient_id: avulsoId,
      modelo: 'avulso',
      valor_sessao_cents: 18000,
    });

    const sched2 = await db.query(
      `INSERT INTO therapist_schedule
         (clinic_id, professional_id, patient_id, scheduled_at, duration_minutes, status, title)
       VALUES ($1, $2, $3, $4, 50, 'completed', 'QA avulso')
       RETURNING id`,
      [solo.clinic_id, solo.prof_id, avulsoId, past],
    );
    cleanup.scheduleIds.push(sched2.rows[0].id);

    const avulsoPay = await callFn('financeiro-upsert-patient-plan', token, {
      action: 'confirm_session_payment',
      schedule_id: sched2.rows[0].id,
      payment_action: 'receber_avulso',
      valor_cents: 20000,
      forma_pagamento: 'pix',
    });
    check('receber avulso 200', avulsoPay.status === 200, `status=${avulsoPay.status}`);

    const txAvulso = await db.query(
      `SELECT valor_cents, categoria, status FROM financeiro_transacoes
       WHERE paciente_id = $1 AND sessao_id = $2 AND deleted_at IS NULL`,
      [avulsoId, sched2.rows[0].id],
    );
    check(
      'ENTRADA avulso 20000 cents',
      txAvulso.rows[0]?.valor_cents === 20000 &&
        txAvulso.rows[0]?.categoria === 'SESSAO_AVULSA' &&
        txAvulso.rows[0]?.status === 'PAGO',
      JSON.stringify(txAvulso.rows[0] ?? null),
    );

    const ledger = await callFn('financeiro-list-patient-plans', token, { patient_id: avulsoId });
    check('ledger paciente 200', ledger.status === 200 && ledger.json?.success === true);
    const ledgerTx = ledger.json?.data?.transacoes ?? [];
    check('ledger contém ENTRADA', Array.isArray(ledgerTx) && ledgerTx.length >= 1, `n=${ledgerTx.length}`);

    console.log('\n═══ 4. Empregado → 403 ═══');
    const empRes = await db.query(`
      SELECT prof.user_id, u.email
      FROM professionals prof
      JOIN auth.users u ON u.id = prof.user_id
      WHERE prof.deleted_at IS NULL
        AND (u.raw_app_meta_data->>'role') = 'professional'
        AND COALESCE((u.raw_app_meta_data->>'is_solo')::boolean, false) = false
      LIMIT 1`);
    if (empRes.rows.length === 0) {
      console.log('  ⚠️  Sem profissional empregado — skip 403');
    } else {
      const empToken = await tokenForUser(admin, ANON, empRes.rows[0].user_id);
      const forbidden = await callFn('financeiro-get-dashboard', empToken, {
        month: new Date().toISOString().slice(0, 7),
      });
      const code = forbidden.json?.error?.code ?? forbidden.json?.code;
      check(
        'empregado 403 FINANCE_FORBIDDEN',
        forbidden.status === 403 && (code === 'FINANCE_FORBIDDEN' || code === 'FORBIDDEN'),
        `status=${forbidden.status} code=${code}`,
      );
    }

    console.log('\n═══ 5. Isolamento tenant ═══');
    const otherClinic = await db.query(`
      SELECT id FROM clinics WHERE id <> $1 LIMIT 1`, [solo.clinic_id]);
    if (otherClinic.rows.length === 0) {
      console.log('  ⚠️  Sem segunda clínica — skip isolamento');
    } else {
      const foreign = await db.query(
        `SELECT count(*)::int AS n FROM financeiro_transacoes
         WHERE clinic_id = $1 AND paciente_id = ANY($2::uuid[])`,
        [otherClinic.rows[0].id, cleanup.patientIds],
      );
      check('transações QA não vazam p/ outra clínica', foreign.rows[0].n === 0);

      const listOther = await callFn('financeiro-list-transacoes', token, {
        month: new Date().toISOString().slice(0, 7),
      });
      const items = listOther.json?.data?.items ?? listOther.json?.items ?? [];
      const leaked = items.some((t) => cleanup.patientIds.includes(t.paciente_id) === false && t.clinic_id && t.clinic_id !== solo.clinic_id);
      check('list-transacoes só clinic do caller', listOther.status === 200 && !leaked);
    }
  }

  console.log('\n═══ Cleanup ═══');
  if (cleanup.scheduleIds.length) {
    await db.query(`UPDATE financeiro_sessoes_cobranca SET deleted_at = now() WHERE schedule_id = ANY($1::uuid[])`, [
      cleanup.scheduleIds,
    ]);
    await db.query(`UPDATE therapist_schedule SET deleted_at = now() WHERE id = ANY($1::uuid[])`, [
      cleanup.scheduleIds,
    ]);
  }
  if (cleanup.patientIds.length) {
    await db.query(`UPDATE financeiro_transacoes SET deleted_at = now() WHERE paciente_id = ANY($1::uuid[])`, [
      cleanup.patientIds,
    ]);
    await db.query(`UPDATE financeiro_saldos_pacientes SET deleted_at = now() WHERE paciente_id = ANY($1::uuid[])`, [
      cleanup.patientIds,
    ]);
    await db.query(`UPDATE financeiro_planos_paciente SET deleted_at = now() WHERE patient_id = ANY($1::uuid[])`, [
      cleanup.patientIds,
    ]);
    await db.query(`UPDATE patients SET deleted_at = now() WHERE id = ANY($1::uuid[])`, [cleanup.patientIds]);
  }
  check('cleanup ok', true);

  await db.end();
  console.log(`\n═══ Resultado: ${passed} ok / ${failed} falhas ═══\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
