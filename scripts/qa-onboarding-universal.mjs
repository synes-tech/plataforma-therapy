/**
 * QA de integração do Onboarding Universal (Prompt 3).
 *
 *   node scripts/qa-onboarding-universal.mjs
 *
 * Exercita contra o Cloud SQL de produção, sempre dentro de uma transação que termina em
 * ROLLBACK, as três garantias novas:
 *
 *   1. create_patient_tx cria paciente + condições + convite atomicamente;
 *   2. rollback_patient_creation apaga de verdade um cadastro recém-criado, mas ARQUIVA
 *      em vez de apagar se algo já se apoiou no paciente;
 *   3. consume_invite propaga o access_level e trata SELF e CAREGIVER com regras distintas.
 */
import { connect } from './cloudsql-connect.mjs';

const results = [];
let client;

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? '  PASS' : '  FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function attempt(label, fn, { expectError } = {}) {
  const sp = `qa_sp_${results.length}`;
  await client.query(`SAVEPOINT ${sp}`);
  try {
    const value = await fn();
    if (expectError) {
      record(label, false, 'operação foi permitida (deveria falhar)');
      await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      return null;
    }
    await client.query(`RELEASE SAVEPOINT ${sp}`);
    return value;
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    if (expectError) {
      const matches = typeof expectError === 'string'
        ? error.message.includes(expectError)
        : true;
      record(label, matches, matches ? `bloqueado: ${expectError}` : `erro diferente: ${error.message}`);
      return null;
    }
    record(label, false, `erro inesperado: ${error.message}`);
    return null;
  }
}

const call = async (sql, params = []) => (await client.query(sql, params)).rows;

console.log('QA de integração — Onboarding Universal\n');

client = await connect();

try {
  await client.query('BEGIN');

  const [{ id: professionalId, clinic_id: clinicId }] = await call(`
    SELECT pr.id, pr.clinic_id
      FROM professionals pr
     WHERE pr.deleted_at IS NULL AND pr.user_id IS NOT NULL
     ORDER BY pr.created_at
     LIMIT 1
  `);
  const [{ id: creatorId }] = await call(
    'SELECT user_id AS id FROM professionals WHERE id = $1', [professionalId],
  );
  const [tea] = await call(`SELECT id, short_label FROM clinical_taxonomy WHERE code = 'TEA'`);
  const [tdah] = await call(`SELECT id FROM clinical_taxonomy WHERE code = 'TDAH'`);

  console.log(`  clínica ${clinicId} / profissional ${professionalId}\n`);

  const basePayload = (overrides) => ({
    clinic_id: clinicId,
    professional_id: professionalId,
    created_by: creatorId,
    gender: 'not_informed',
    diagnoses: [],
    ...overrides,
  });

  const createPatient = async (payload) => {
    const [{ create_patient_tx: result }] = await call(
      'SELECT create_patient_tx($1::jsonb) AS create_patient_tx', [JSON.stringify(payload)],
    );
    return result;
  };

  console.log('--- Criação atômica: adulto com acesso próprio ---');
  const adulto = await attempt('create_patient_tx cria adulto com convite SELF', () =>
    createPatient(basePayload({
      name: 'QA Adulto Autônomo',
      birth_date: '1990-05-10',
      profile_type: 'ADULT',
      autonomy_level: 'SELF_MANAGED',
      active_modules: ['CLINICO_GERAL'],
      email_paciente: 'qa.adulto@exemplo.com',
      contact_scope: 'patient',
      support_network: 'Parceira e dois amigos próximos',
      condition_ids: [tdah.id],
      invite: {
        access_level: 'SELF',
        relationship: 'o próprio paciente',
        email: 'qa.adulto@exemplo.com',
        name: 'QA Adulto Autônomo',
        expires_in_hours: 168,
      },
    })));

  if (adulto) {
    record('Convite nasce junto do paciente', Boolean(adulto.invite_code),
      `código ${adulto.invite_code}`);
    record('Condição clínica vinculada', adulto.conditions_count === 1,
      `${adulto.conditions_count} condição(ões)`);

    const [invite] = await call('SELECT access_level, invited_email FROM invites WHERE id = $1',
      [adulto.invite_id]);
    record('Convite do adulto sai como SELF', invite.access_level === 'SELF', invite.access_level);
    record('Convite guarda o destinatário', invite.invited_email === 'qa.adulto@exemplo.com',
      invite.invited_email);

    const [p] = await call('SELECT profile_type, active_modules::text m, support_network FROM patients WHERE id = $1',
      [adulto.patient_id]);
    record('Perfil gravado como ADULT', p.profile_type === 'ADULT', p.profile_type);
    record('Rede de apoio preenchida no lugar da dinâmica familiar',
      p.support_network === 'Parceira e dois amigos próximos', p.support_network);

    const [{ diagnoses }] = await call('SELECT diagnoses::text FROM patients WHERE id = $1',
      [adulto.patient_id]);
    record('Dual-write projeta o diagnóstico da taxonomia', diagnoses.includes('TDAH'), diagnoses);
  }

  console.log('\n--- Criação atômica: criança com cuidador ---');
  const crianca = await attempt('create_patient_tx cria criança com convite CAREGIVER', () =>
    createPatient(basePayload({
      name: 'QA Criança',
      birth_date: '2019-03-01',
      profile_type: 'CHILD',
      autonomy_level: 'DEPENDENT',
      active_modules: ['CLINICO_GERAL', 'NEURODESENVOLVIMENTO'],
      email_responsavel: 'qa.mae@exemplo.com',
      contact_scope: 'responsible',
      responsaveis: 'Mãe e avó',
      composicao_familiar: 'Mora com a mãe e a avó materna',
      condition_ids: [tea.id],
      invite: {
        access_level: 'CAREGIVER',
        relationship: 'mãe',
        email: 'qa.mae@exemplo.com',
        name: 'QA Mãe',
      },
    })));

  if (crianca) {
    const [invite] = await call('SELECT access_level FROM invites WHERE id = $1', [crianca.invite_id]);
    record('Convite da criança sai como CAREGIVER', invite.access_level === 'CAREGIVER',
      invite.access_level);

    const [p] = await call('SELECT active_modules::text m FROM patients WHERE id = $1',
      [crianca.patient_id]);
    record('Módulo de neurodesenvolvimento ativo', p.m.includes('NEURODESENVOLVIMENTO'), p.m);
  }

  console.log('\n--- Perfil derivado quando o cliente antigo não envia ---');
  const semPerfil = await attempt('Trigger deriva profile_type ausente', () =>
    createPatient(basePayload({
      name: 'QA Sem Perfil',
      birth_date: '2011-01-01', // 15 anos em 2026 → ADOLESCENT
      email_responsavel: 'qa.sp@exemplo.com',
    })));

  if (semPerfil) {
    const [p] = await call(
      'SELECT profile_type, autonomy_level, active_modules::text m FROM patients WHERE id = $1',
      [semPerfil.patient_id],
    );
    record('Perfil derivado da data de nascimento', p.profile_type === 'ADOLESCENT', p.profile_type);
    record('Autonomia derivada do perfil', p.autonomy_level === 'SUPPORTED', p.autonomy_level);
    record('Módulo base garantido', p.m.includes('CLINICO_GERAL'), p.m);
    record('Cadastro sem convite não cria invite', semPerfil.invite_code === null,
      String(semPerfil.invite_code));
  }

  console.log('\n--- Rollback do cadastro ---');
  const descartavel = await createPatient(basePayload({
    name: 'QA Para Descartar',
    birth_date: '1985-07-07',
    profile_type: 'ADULT',
    email_paciente: 'qa.descarte@exemplo.com',
    condition_ids: [tea.id],
    invite: { access_level: 'SELF', email: 'qa.descarte@exemplo.com' },
  }));

  const [{ rollback_patient_creation: hardDeleted }] = await call(
    'SELECT rollback_patient_creation($1) AS rollback_patient_creation', [descartavel.patient_id],
  );
  const [{ count: sobrouPaciente }] = await call(
    'SELECT count(*)::int FROM patients WHERE id = $1', [descartavel.patient_id],
  );
  const [{ count: sobrouCondicao }] = await call(
    'SELECT count(*)::int FROM patient_conditions WHERE patient_id = $1', [descartavel.patient_id],
  );
  const [{ count: sobrouConvite }] = await call(
    'SELECT count(*)::int FROM invites WHERE patient_id = $1', [descartavel.patient_id],
  );

  record('Rollback apaga o paciente de verdade', hardDeleted === true && sobrouPaciente === 0,
    `hard=${hardDeleted}, restaram ${sobrouPaciente}`);
  record('Rollback leva junto as condições clínicas', sobrouCondicao === 0, `${sobrouCondicao}`);
  record('Rollback leva junto o convite', sobrouConvite === 0, `${sobrouConvite}`);

  console.log('\n--- Rollback protege paciente que já tem histórico ---');
  const comHistorico = await createPatient(basePayload({
    name: 'QA Com Histórico',
    birth_date: '1980-02-02',
    profile_type: 'ADULT',
    email_paciente: 'qa.hist@exemplo.com',
  }));
  // Um vínculo de portal já basta como "alguém depende deste cadastro".
  const userHist = crypto.randomUUID();
  await call('INSERT INTO auth.users (id) VALUES ($1)', [userHist]);
  const [fmHist] = await call(
    `INSERT INTO family_members (user_id, clinic_id, patient_id, name, relationship, created_by)
     VALUES ($1, $2, $3, 'QA Vínculo', 'qa', $1) RETURNING id`,
    [userHist, clinicId, comHistorico.patient_id],
  );
  await call(
    `INSERT INTO patient_family_links (patient_id, family_member_id, clinic_id, user_id, relationship, created_by)
     VALUES ($1, $2, $3, $4, 'qa', $4)`,
    [comHistorico.patient_id, fmHist.id, clinicId, userHist],
  );
  const [{ rollback_patient_creation: soft }] = await call(
    'SELECT rollback_patient_creation($1) AS rollback_patient_creation', [comHistorico.patient_id],
  );
  const [preservado] = await call('SELECT deleted_at FROM patients WHERE id = $1',
    [comHistorico.patient_id]);
  record('Paciente com histórico é arquivado, nunca apagado',
    soft === false && preservado?.deleted_at !== null,
    `hard=${soft}, deleted_at=${preservado?.deleted_at ? 'preenchido' : 'nulo'}`);

  console.log('\n--- consume_invite propaga o nível de acesso ---');
  const alvo = await createPatient(basePayload({
    name: 'QA Consumo',
    birth_date: '1992-09-09',
    profile_type: 'ADULT',
    email_paciente: 'qa.consumo@exemplo.com',
    invite: { access_level: 'SELF', email: 'qa.consumo@exemplo.com', name: 'QA Consumo' },
  }));

  const userSelf = crypto.randomUUID();
  await call('INSERT INTO auth.users (id) VALUES ($1)', [userSelf]);
  const [{ consume_invite: consumo }] = await call(
    'SELECT consume_invite($1, $2, $3, $4) AS consume_invite',
    [alvo.invite_code, userSelf, 'QA Consumo', 'qa.consumo@exemplo.com'],
  );
  record('consume_invite devolve o access_level', consumo.access_level === 'SELF',
    consumo.access_level);

  const [link] = await call(
    'SELECT access_level, is_primary_contact FROM patient_family_links WHERE user_id = $1',
    [userSelf],
  );
  record('Vínculo criado como SELF', link.access_level === 'SELF', link.access_level);
  record('Primeiro vínculo vira contato principal', link.is_primary_contact === true,
    String(link.is_primary_contact));

  console.log('\n--- Um paciente só tem um acesso próprio ---');
  const segundoConvite = await createPatient(basePayload({
    name: 'QA Consumo 2',
    birth_date: '1992-09-09',
    profile_type: 'ADULT',
    email_paciente: 'qa.consumo2@exemplo.com',
  }));
  await call(
    `INSERT INTO invites (clinic_id, patient_id, professional_id, code, status, relationship,
                          access_level, expires_at, created_by)
     VALUES ($1, $2, $3, 'QASELF02', 'pending', 'o próprio paciente', 'SELF', now() + interval '1 day', $4)`,
    [clinicId, alvo.patient_id, professionalId, creatorId],
  );
  const userSelf2 = crypto.randomUUID();
  await call('INSERT INTO auth.users (id) VALUES ($1)', [userSelf2]);
  await attempt(
    'Segundo acesso SELF no mesmo paciente é recusado',
    () => call('SELECT consume_invite($1, $2, $3, $4)',
      ['QASELF02', userSelf2, 'Intruso', 'intruso@exemplo.com']),
    { expectError: 'SELF_ACCESS_ALREADY_EXISTS' },
  );
  void segundoConvite;

  console.log('\n--- Cota de familiares não penaliza o acesso próprio ---');
  const [{ count: caregiversDoAlvo }] = await call(
    `SELECT count(*)::int FROM patient_family_links
      WHERE patient_id = $1 AND access_level = 'CAREGIVER' AND revoked_at IS NULL`,
    [alvo.patient_id],
  );
  record('Acesso SELF não ocupa vaga de cuidador', caregiversDoAlvo === 0,
    `${caregiversDoAlvo} cuidador(es)`);

  console.log('\n--- IDs de taxonomia inválidos não criam condição fantasma ---');
  const comIdFalso = await createPatient(basePayload({
    name: 'QA Taxonomia Falsa',
    birth_date: '1988-04-04',
    profile_type: 'ADULT',
    email_paciente: 'qa.tax@exemplo.com',
    condition_ids: [crypto.randomUUID()],
  }));
  record('ID inexistente é ignorado pelo join, sem criar lixo',
    comIdFalso.conditions_count === 0, `${comIdFalso.conditions_count}`);
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
console.log('Rollback executado, base inalterada.');
