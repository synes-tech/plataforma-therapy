#!/usr/bin/env node
/**
 * QA — Controle de custos mensais
 * Uso: node --env-file=.env scripts/qa-financeiro-custos.mjs
 */
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB = process.env.DATABASE_URL;

let passed = 0;
let failed = 0;
const cleanup = { custoIds: [], txIds: [] };

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

async function tokenForUser(admin, userId) {
  const pw = `QaCusto-${Date.now()}!`;
  await admin.auth.admin.updateUserById(userId, { password: pw });
  const { data: user } = await admin.auth.admin.getUserById(userId);
  const cli = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await cli.auth.signInWithPassword({
    email: user.user?.email,
    password: pw,
  });
  if (error) throw error;
  return data.session.access_token;
}

async function main() {
  if (!URL || !ANON || !SERVICE || !DB) {
    console.error('Env ausente');
    process.exit(1);
  }

  const db = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const admin = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const TS = Date.now();
  const month = new Date().toISOString().slice(0, 7);

  console.log('\n═══ 1. Schema ═══');
  const tbl = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = 'financeiro_custos_recorrentes'`,
  );
  check('tabela financeiro_custos_recorrentes', tbl.rows.length === 1);
  const rpc = await db.query(
    `SELECT 1 FROM pg_proc WHERE proname = 'financeiro_gerar_custos_mes'`,
  );
  check('RPC financeiro_gerar_custos_mes', rpc.rows.length === 1);

  console.log('\n═══ 2. Owner: criar → PENDENTE → pagar → sem duplicata ═══');
  const soloRes = await db.query(`
    SELECT prof.id AS prof_id, prof.clinic_id, prof.user_id, u.email
    FROM professionals prof
    JOIN auth.users u ON u.id = prof.user_id
    WHERE prof.deleted_at IS NULL
      AND (u.raw_app_meta_data->>'role') = 'professional'
      AND COALESCE((u.raw_app_meta_data->>'is_solo')::boolean, false) = true
    LIMIT 1`);
  if (soloRes.rows.length === 0) {
    console.log('  ⚠️  Sem solo — abortando API checks');
  } else {
    const solo = soloRes.rows[0];
    const token = await tokenForUser(admin, solo.user_id);
    const desc = `QA Aluguel ${TS}`;

    const create = await callFn('financeiro-upsert-transacao', token, {
      action: 'upsert_custo_recorrente',
      descricao: desc,
      valor_cents: 200000,
      dia_vencimento: 10,
      categoria: 'CUSTO_FIXO',
    });
    check('criar custo 201/200', create.status === 201 || create.status === 200, `status=${create.status}`);
    const custoId = create.json?.data?.item?.id;
    if (custoId) cleanup.custoIds.push(custoId);

    const list1 = await callFn('financeiro-list-transacoes', token, { mode: 'custos', month });
    check('list custos 200', list1.status === 200);
    const templates = list1.json?.data?.templates ?? [];
    const titulos1 = list1.json?.data?.titulos_mes ?? [];
    check('template na lista', templates.some((t) => t.id === custoId));
    const titulo = titulos1.find((t) => t.recorrencia_chave === `${custoId}:${month}`);
    check('título PENDENTE/ATRASADO gerado', !!titulo && ['PENDENTE', 'ATRASADO'].includes(titulo.status), JSON.stringify(titulo?.status));
    if (titulo) cleanup.txIds.push(titulo.id);

    const pay = await callFn('financeiro-upsert-transacao', token, {
      action: 'marcar_pago',
      id: titulo?.id,
    });
    check('marcar pago 200', pay.status === 200, `status=${pay.status}`);
    check('status PAGO', pay.json?.data?.item?.status === 'PAGO');

    const list2 = await callFn('financeiro-list-transacoes', token, { mode: 'custos', month });
    const titulos2 = (list2.json?.data?.titulos_mes ?? []).filter(
      (t) => t.recorrencia_chave === `${custoId}:${month}`,
    );
    check('sem duplicata após reabrir', titulos2.length === 1, `n=${titulos2.length}`);

    const pause = await callFn('financeiro-upsert-transacao', token, {
      action: 'toggle_custo',
      id: custoId,
      ativo: false,
    });
    check('pausar custo 200', pause.status === 200 && pause.json?.data?.item?.ativo === false);

    console.log('\n═══ 3. Empregado 403 ═══');
    const empRes = await db.query(`
      SELECT prof.user_id FROM professionals prof
      JOIN auth.users u ON u.id = prof.user_id
      WHERE prof.deleted_at IS NULL
        AND (u.raw_app_meta_data->>'role') = 'professional'
        AND COALESCE((u.raw_app_meta_data->>'is_solo')::boolean, false) = false
      LIMIT 1`);
    if (empRes.rows.length === 0) {
      console.log('  ⚠️  Sem empregado — skip');
    } else {
      const empToken = await tokenForUser(admin, empRes.rows[0].user_id);
      const forbidden = await callFn('financeiro-list-transacoes', empToken, {
        mode: 'custos',
        month,
      });
      const code = forbidden.json?.error?.code;
      check(
        'empregado 403',
        forbidden.status === 403 && (code === 'FINANCE_FORBIDDEN' || code === 'FORBIDDEN'),
        `status=${forbidden.status} code=${code}`,
      );
    }
  }

  console.log('\n═══ Cleanup ═══');
  if (cleanup.txIds.length) {
    await db.query(`UPDATE financeiro_transacoes SET deleted_at = now() WHERE id = ANY($1::uuid[])`, [
      cleanup.txIds,
    ]);
  }
  if (cleanup.custoIds.length) {
    await db.query(
      `UPDATE financeiro_custos_recorrentes SET deleted_at = now(), ativo = false WHERE id = ANY($1::uuid[])`,
      [cleanup.custoIds],
    );
  }
  check('cleanup ok', true);

  await db.end();
  console.log(`\n═══ Resultado: ${passed} ok / ${failed} falhas ═══\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
