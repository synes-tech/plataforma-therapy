/**
 * QA de isolamento (RLS) da fundação B2B + B2C.
 *
 *   node scripts/qa-rls-b2c.mjs
 *
 * Roda contra o Cloud SQL de produção dentro de uma transação que SEMPRE termina em
 * ROLLBACK: nenhum dado de teste é persistido.
 *
 * O que é verificado, além do óbvio "cada um vê o seu":
 *   - O terapeuta NÃO consegue ler o conteúdo do chat do paciente com a Ivy (ADR-06).
 *     Ele recebe alertas e resumos, nunca o desabafo literal.
 *   - O paciente NÃO consegue inserir mensagem direto no banco, o que burlaria o
 *     classificador de risco (ADR-05).
 *   - Um cuidador (CAREGIVER) não tem acesso ao chat, que é exclusivo de quem é SELF.
 */
import { connect } from './cloudsql-connect.mjs';

const results = [];
let client;

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const tag = passed ? '  PASS' : '  FAIL';
  console.log(`${tag}  ${name}${detail ? `  — ${detail}` : ''}`);
}

let savepointSeq = 0;

/**
 * Executa uma query como um usuário do portal/clínica, com claims simuladas.
 *
 * Cada chamada roda dentro de um savepoint: como os testes negativos provocam erros de
 * propósito, sem isso o primeiro bloqueio abortaria a transação inteira e todas as
 * asserções seguintes falhariam por efeito colateral, não por vazamento real.
 */
async function asUser({ sub, role, clinicId }, sql, params = []) {
  const sp = `qa_sp_${++savepointSeq}`;
  const claims = JSON.stringify({
    sub,
    role,
    app_metadata: { role, clinic_id: clinicId ?? null },
  });

  await client.query(`SAVEPOINT ${sp}`);
  try {
    await client.query('SET LOCAL ROLE authenticated');
    await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims]);
    const { rows } = await client.query(sql, params);
    await client.query(`RELEASE SAVEPOINT ${sp}`);
    return rows;
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    await client.query(`RELEASE SAVEPOINT ${sp}`);
    throw error;
  } finally {
    await client.query('RESET ROLE').catch(() => {});
  }
}

async function expectRows(label, user, sql, params, expected) {
  try {
    const rows = await asUser(user, sql, params);
    record(label, rows.length === expected, `esperado ${expected}, obtido ${rows.length}`);
  } catch (error) {
    record(label, false, `erro inesperado: ${error.message}`);
  }
}

/** Para casos em que o volume correto é "tudo que existe": compara com a visão do owner. */
async function expectSameAsOwner(label, user, sql, params) {
  const { rows: todas } = await client.query(sql, params);
  try {
    const rows = await asUser(user, sql, params);
    record(label, rows.length === todas.length, `owner vê ${todas.length}, usuário vê ${rows.length}`);
  } catch (error) {
    record(label, false, `erro inesperado: ${error.message}`);
  }
}

async function expectDenied(label, user, sql, params) {
  try {
    await asUser(user, sql, params);
    record(label, false, 'a operação foi PERMITIDA (deveria ser bloqueada)');
  } catch (error) {
    // 42501 = insufficient_privilege (GRANT); RLS de INSERT sem policy → new row violates
    const blocked = error.code === '42501' || /row-level security|permission denied/i.test(error.message);
    record(label, blocked, blocked ? `bloqueado (${error.code})` : `erro diferente: ${error.message}`);
  }
}

console.log('QA de RLS — fundação B2B + B2C\n');

client = await connect();

try {
  await client.query('BEGIN');

  // ---------------------------------------------------------------------------------
  // Cenário: dois pacientes reais de clínicas distintas, cada um com seu usuário SELF.
  // ---------------------------------------------------------------------------------
  const { rows: pacientes } = await client.query(`
    SELECT p.id, p.clinic_id, p.professional_id, pr.user_id AS professional_user_id
      FROM patients p
      JOIN professionals pr ON pr.id = p.professional_id
     WHERE p.deleted_at IS NULL AND pr.user_id IS NOT NULL
     ORDER BY p.clinic_id, p.created_at
  `);

  const porClinica = new Map();
  for (const p of pacientes) {
    if (!porClinica.has(p.clinic_id)) porClinica.set(p.clinic_id, p);
  }
  const distintos = [...porClinica.values()];
  if (distintos.length < 2) throw new Error('Base sem dois pacientes de clínicas distintas.');

  const [pacienteA, pacienteB] = distintos;
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  const userCaregiverA = crypto.randomUUID();

  console.log(`  paciente A: ${pacienteA.id} (clínica ${pacienteA.clinic_id})`);
  console.log(`  paciente B: ${pacienteB.id} (clínica ${pacienteB.clinic_id})\n`);

  // family_members.user_id e created_by têm FK para auth.users.
  for (const uid of [userA, userB, userCaregiverA]) {
    await client.query('INSERT INTO auth.users (id) VALUES ($1) ON CONFLICT DO NOTHING', [uid]);
  }

  const mk = async (patient, userId, name) => {
    const { rows } = await client.query(
      `INSERT INTO family_members (id, user_id, clinic_id, patient_id, name, relationship, email, created_by)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'self', $5, $1) RETURNING id`,
      [userId, patient.clinic_id, patient.id, name, `${userId}@qa.local`],
    );
    return rows[0].id;
  };

  const fmA = await mk(pacienteA, userA, 'QA Paciente A');
  const fmB = await mk(pacienteB, userB, 'QA Paciente B');
  const fmCare = await mk(pacienteA, userCaregiverA, 'QA Cuidador A');

  const link = async (patient, fmId, userId, level) => {
    const { rows } = await client.query(
      `INSERT INTO patient_family_links (id, patient_id, family_member_id, clinic_id, user_id, relationship, access_level, created_by)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'qa', $5, $4) RETURNING id`,
      [patient.id, fmId, patient.clinic_id, userId, level],
    );
    return rows[0].id;
  };

  const linkA = await link(pacienteA, fmA, userA, 'SELF');
  const linkB = await link(pacienteB, fmB, userB, 'SELF');
  await link(pacienteA, fmCare, userCaregiverA, 'CAREGIVER');

  const thread = async (patient, userId, linkId) => {
    const { rows } = await client.query(
      `INSERT INTO patient_copilot_threads (patient_id, clinic_id, portal_link_id, user_id, title)
       VALUES ($1, $2, $3, $4, 'QA') RETURNING id`,
      [patient.id, patient.clinic_id, linkId, userId],
    );
    return rows[0].id;
  };

  const threadA = await thread(pacienteA, userA, linkA);
  const threadB = await thread(pacienteB, userB, linkB);

  const msg = async (threadId, patient, content, risk) => {
    const { rows } = await client.query(
      `INSERT INTO patient_copilot_messages (thread_id, patient_id, clinic_id, role, content, risk_level, risk_detector)
       VALUES ($1, $2, $3, 'user', $4, $5, 'both') RETURNING id, is_severe_risk`,
      [threadId, patient.id, patient.clinic_id, content, risk],
    );
    return rows[0];
  };

  const msgA = await msg(threadA, pacienteA, 'QA: desabafo privado do paciente A', 'MODERATE');
  const msgSevere = await msg(threadA, pacienteA, 'QA: mensagem de risco severo', 'SEVERE');
  await msg(threadB, pacienteB, 'QA: desabafo privado do paciente B', 'LOW');

  await client.query(
    `INSERT INTO clinical_alerts (patient_id, clinic_id, professional_id, source, severity, title, summary, source_ref_id)
     VALUES ($1, $2, $3, 'COPILOT_B2C', 'SEVERE', 'QA alerta', 'Resumo gerado, sem transcrição literal.', $4)`,
    [pacienteA.id, pacienteA.clinic_id, pacienteA.professional_id, msgSevere.id],
  );

  const portalA = { sub: userA, role: 'family', clinicId: pacienteA.clinic_id };
  const portalB = { sub: userB, role: 'family', clinicId: pacienteB.clinic_id };
  const cuidadorA = { sub: userCaregiverA, role: 'family', clinicId: pacienteA.clinic_id };
  const terapeutaA = {
    sub: pacienteA.professional_user_id,
    role: 'professional',
    clinicId: pacienteA.clinic_id,
  };

  console.log('--- Coluna gerada de risco ---');
  record(
    'risk_level=SEVERE marca is_severe_risk automaticamente',
    msgSevere.is_severe_risk === true,
    `is_severe_risk=${msgSevere.is_severe_risk}`,
  );
  record(
    'risk_level=MODERATE não marca is_severe_risk',
    msgA.is_severe_risk === false,
    `is_severe_risk=${msgA.is_severe_risk}`,
  );

  console.log('\n--- Isolamento entre pacientes ---');
  await expectRows('Paciente A lê as próprias mensagens', portalA,
    'SELECT id FROM patient_copilot_messages WHERE patient_id = $1', [pacienteA.id], 2);
  await expectRows('Paciente A NÃO lê mensagem do paciente B', portalA,
    'SELECT id FROM patient_copilot_messages WHERE patient_id = $1', [pacienteB.id], 0);
  await expectRows('Paciente B NÃO lê mensagem do paciente A', portalB,
    'SELECT id FROM patient_copilot_messages WHERE patient_id = $1', [pacienteA.id], 0);
  await expectRows('Paciente A NÃO enxerga thread do paciente B', portalA,
    'SELECT id FROM patient_copilot_threads WHERE id = $1', [threadB], 0);

  console.log('\n--- Sigilo do chat perante o terapeuta (ADR-06) ---');
  await expectRows('Terapeuta NÃO lê o chat do próprio paciente', terapeutaA,
    'SELECT id FROM patient_copilot_messages WHERE patient_id = $1', [pacienteA.id], 0);
  await expectRows('Terapeuta NÃO lê as threads do paciente', terapeutaA,
    'SELECT id FROM patient_copilot_threads WHERE patient_id = $1', [pacienteA.id], 0);
  await expectRows('Terapeuta LÊ o alerta clínico gerado', terapeutaA,
    `SELECT id FROM clinical_alerts WHERE patient_id = $1 AND title = 'QA alerta'`, [pacienteA.id], 1);
  await expectRows('Terapeuta NÃO lê alerta de paciente de outra clínica', terapeutaA,
    'SELECT id FROM clinical_alerts WHERE patient_id = $1', [pacienteB.id], 0);

  console.log('\n--- Cuidador não acessa o chat do paciente autônomo ---');
  await expectRows('CAREGIVER NÃO lê o chat (exclusivo de SELF)', cuidadorA,
    'SELECT id FROM patient_copilot_messages WHERE patient_id = $1', [pacienteA.id], 0);
  await expectSameAsOwner('CAREGIVER lê o quadro clínico do paciente vinculado', cuidadorA,
    'SELECT id FROM patient_conditions WHERE patient_id = $1', [pacienteA.id]);

  console.log('\n--- Escrita do chat é exclusiva do backend (ADR-05) ---');
  await expectDenied('Paciente NÃO insere mensagem direto no banco', portalA,
    `INSERT INTO patient_copilot_messages (thread_id, patient_id, clinic_id, role, content, risk_level)
     VALUES ($1, $2, $3, 'user', 'burlando o classificador', 'LOW')`,
    [threadA, pacienteA.id, pacienteA.clinic_id]);
  await expectDenied('Paciente NÃO altera o risk_level de uma mensagem', portalA,
    `UPDATE patient_copilot_messages SET risk_level = 'LOW' WHERE id = $1`, [msgSevere.id]);
  await expectDenied('Paciente NÃO cria assinatura sem passar pelo Stripe', portalA,
    `INSERT INTO patient_subscriptions (patient_id, clinic_id, status)
     VALUES ($1, $2, 'active')`, [pacienteA.id, pacienteA.clinic_id]);

  console.log('\n--- Notas clínicas estruturadas (Cenário 1 — caminho dourado) ---');
  const { rows: notaA } = await client.query(
    `INSERT INTO session_notes (patient_id, professional_id, clinic_id, status, content, visivel_familia)
     VALUES ($1, $2, $3, 'approved', '{"subjective":"SOAP privado do paciente A"}'::jsonb, false)
     RETURNING id`,
    [pacienteA.id, pacienteA.professional_id, pacienteA.clinic_id],
  );
  const { rows: notaB } = await client.query(
    `INSERT INTO session_notes (patient_id, professional_id, clinic_id, status, content, visivel_familia)
     VALUES ($1, $2, $3, 'approved', '{"subjective":"SOAP do paciente B"}'::jsonb, true)
     RETURNING id`,
    [pacienteB.id, pacienteB.professional_id, pacienteB.clinic_id],
  );
  await expectRows('Paciente A NÃO lê nota SOAP não compartilhada (própria)', portalA,
    'SELECT id FROM session_notes WHERE id = $1', [notaA[0].id], 0);
  await expectRows('Paciente A NÃO lê nota clínica do paciente B', portalA,
    'SELECT id FROM session_notes WHERE id = $1', [notaB[0].id], 0);
  await expectRows('Paciente A NÃO lê o chat do paciente B', portalA,
    'SELECT id FROM patient_copilot_messages WHERE patient_id = $1', [pacienteB.id], 0);

  console.log('\n--- Diário e taxonomia ---');
  await expectSameAsOwner('Paciente lê o próprio diário', portalA,
    'SELECT id FROM diary_entries WHERE patient_id = $1 AND deleted_at IS NULL', [pacienteA.id]);
  await expectRows('Paciente NÃO lê diário de outro paciente', portalA,
    'SELECT id FROM diary_entries WHERE patient_id = $1', [pacienteB.id], 0);
  await expectRows('Catálogo de taxonomia é legível pelo portal', portalA,
    `SELECT id FROM clinical_taxonomy WHERE code = 'TEA'`, [], 1);
  await expectDenied('Portal NÃO edita o catálogo clínico', portalA,
    `UPDATE clinical_taxonomy SET label = 'hackeado' WHERE code = 'TEA'`, []);

  console.log('\n--- Consentimento ---');
  const semConsent = await asUser(terapeutaA,
    'SELECT public.patient_allows_summary_sharing($1) AS ok', [pacienteA.id]);
  record('patient_allows_summary_sharing = false por padrão', semConsent[0].ok === false,
    `retornou ${semConsent[0].ok}`);

  await client.query(
    `INSERT INTO patient_consents (patient_id, clinic_id, user_id, consent_type, version, granted)
     VALUES ($1, $2, $3, 'CLINICAL_SUMMARY_SHARING', 'v1', true)`,
    [pacienteA.id, pacienteA.clinic_id, userA],
  );
  const comConsent = await asUser(terapeutaA,
    'SELECT public.patient_allows_summary_sharing($1) AS ok', [pacienteA.id]);
  record('patient_allows_summary_sharing = true após consentir', comConsent[0].ok === true,
    `retornou ${comConsent[0].ok}`);

  console.log('\n--- Unicidade e integridade ---');
  await client.query('SAVEPOINT qa_unique');
  try {
    const outro = crypto.randomUUID();
    await client.query('INSERT INTO auth.users (id) VALUES ($1)', [outro]);
    await client.query(
      `INSERT INTO patient_family_links (patient_id, family_member_id, clinic_id, user_id, relationship, access_level, created_by)
       VALUES ($1, $2, $3, $4, 'qa2', 'SELF', $4)`,
      [pacienteA.id, fmCare, pacienteA.clinic_id, outro],
    );
    record('Bloqueia segundo acesso SELF para o mesmo paciente', false, 'permitiu duplicar');
    await client.query('ROLLBACK TO SAVEPOINT qa_unique');
  } catch (error) {
    record('Bloqueia segundo acesso SELF para o mesmo paciente', error.code === '23505',
      `código ${error.code}`);
    await client.query('ROLLBACK TO SAVEPOINT qa_unique');
  }

  const { rows: contadores } = await client.query(
    'SELECT message_count FROM patient_copilot_threads WHERE id = $1', [threadA],
  );
  record('Trigger mantém message_count coerente', Number(contadores[0].message_count) === 2,
    `message_count=${contadores[0].message_count}`);

  const { rows: uso } = await client.query(
    `SELECT messages_count FROM patient_copilot_usage WHERE patient_id = $1`, [pacienteA.id],
  );
  record('Trigger agrega uso mensal para fair use', Number(uso[0]?.messages_count) === 2,
    `messages_count=${uso[0]?.messages_count}`);
} finally {
  await client.query('ROLLBACK').catch(() => {});
  await client.end();
}

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
if (failed.length > 0) {
  console.log('\nFalhas:');
  failed.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
  process.exit(1);
}
console.log('Nenhum vazamento detectado. Rollback executado, base inalterada.');
