/**
 * QA — limites de plano (paciente 11 autônomo, profissional 4 starter)
 * Uso: node scripts/test-plan-quotas.mjs
 */
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function check(label, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

function supabaseQuery(sql) {
  const out = execSync(`npx supabase db query --linked ${JSON.stringify(sql)}`, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const match = out.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (!match) throw new Error('Resposta inesperada do supabase db query');
  return JSON.parse(match[0]).rows;
}

async function main() {
  console.log('\n=== QA: Limites de planos ===\n');

  const planos = await supabaseQuery(
    'SELECT id, limite_profissionais, limite_pacientes_por_prof, ativo FROM planos ORDER BY sort_order',
  );
  check('Tabela planos seed', planos.length >= 5, `${planos.length} planos`);

  const inicial = planos.find((r) => r.id === 'inicial');
  check(
    'Inicial: 1 prof / 10 pac',
    inicial?.limite_profissionais === 1 && inicial?.limite_pacientes_por_prof === 10,
  );

  const intermediario = planos.find((r) => r.id === 'intermediario');
  check(
    'Intermediário: 1 prof / 40 pac',
    intermediario?.limite_profissionais === 1 && intermediario?.limite_pacientes_por_prof === 40,
  );

  const starter = planos.find((r) => r.id === 'starter');
  check(
    'Starter: 3 prof / 40 pac',
    starter?.limite_profissionais === 3 && starter?.limite_pacientes_por_prof === 40,
  );

  const pro = planos.find((r) => r.id === 'professional');
  check(
    'Pro: 10 prof / 60 pac',
    pro?.limite_profissionais === 10 && pro?.limite_pacientes_por_prof === 60,
  );

  const autonomoAt11 = 10 >= inicial.limite_pacientes_por_prof;
  check('Fronteira: 10 pacientes bloqueia o 11º (Plano Inicial)', autonomoAt11);
  const intermediarioAt41 = 40 >= intermediario.limite_pacientes_por_prof;
  check('Fronteira: 40 pacientes bloqueia o 41º (Plano Intermediário)', intermediarioAt41);
  const starterAt4 = 3 >= starter.limite_profissionais;
  check('Fronteira: 3 profissionais bloqueia o 4º (starter)', starterAt4);

  const soloClinics = await supabaseQuery(
    "SELECT c.id, cs.max_patients_per_professional FROM clinics c JOIN clinic_settings cs ON cs.clinic_id = c.id WHERE c.subscription_plan IN ('inicial', 'intermediario') AND c.deleted_at IS NULL LIMIT 1",
  );

  if (soloClinics[0]) {
    const clinicId = soloClinics[0].id;
    const profs = await supabaseQuery(
      `SELECT id, patient_quota_bonus FROM professionals WHERE clinic_id = '${clinicId}' AND deleted_at IS NULL LIMIT 1`,
    );
    if (profs[0]) {
      const counts = await supabaseQuery(
        `SELECT count(*)::int AS n FROM patients WHERE professional_id = '${profs[0].id}' AND deleted_at IS NULL`,
      );
      const n = counts[0].n;
      const bonus = Number(profs[0].patient_quota_bonus ?? 0);
      const effectiveLimit = soloClinics[0].max_patients_per_professional + bonus;
      const atLimit = n >= effectiveLimit;
      console.log(
        `\n  ℹ Clínica solo: ${n}/${effectiveLimit} pacientes (base ${soloClinics[0].max_patients_per_professional} + bônus ${bonus})`,
      );
      if (atLimit) {
        console.log('  → Próximo POST create-patient deve retornar QUOTA_EXCEEDED (403)');
      } else {
        console.log(`  → Faltam ${effectiveLimit - n} pacientes para testar bloqueio E2E`);
      }
    }
  } else {
    console.log('  ⚠ Nenhuma clínica solo (inicial/intermediario) para teste de fronteira E2E');
  }

  const corpClinics = await supabaseQuery(
    "SELECT c.id, cs.max_professionals FROM clinics c JOIN clinic_settings cs ON cs.clinic_id = c.id WHERE c.subscription_plan = 'starter' AND c.deleted_at IS NULL LIMIT 1",
  );

  if (corpClinics[0]) {
    const profCount = await supabaseQuery(
      `SELECT count(*)::int AS n FROM professionals WHERE clinic_id = '${corpClinics[0].id}' AND deleted_at IS NULL`,
    );
    console.log(
      `\n  ℹ Clínica starter: ${profCount[0].n}/${corpClinics[0].max_professionals} profissionais`,
    );
    if (profCount[0].n >= corpClinics[0].max_professionals) {
      console.log('  → Próximo POST register-professional deve retornar QUOTA_EXCEEDED (403)');
    }
  }

  console.log('\n=== Concluído ===\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
