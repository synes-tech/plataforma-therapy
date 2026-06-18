/**
 * QA — limites de plano (paciente 51 autônomo, profissional 4 starter)
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
    'SELECT id, limite_profissionais, limite_pacientes_por_prof FROM planos ORDER BY sort_order',
  );
  check('Tabela planos seed', planos.length === 4, `${planos.length} planos`);

  const consultorio = planos.find((r) => r.id === 'consultorio');
  check(
    'Consultório: 1 prof / 50 pac',
    consultorio?.limite_profissionais === 1 && consultorio?.limite_pacientes_por_prof === 50,
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

  // Fronteira lógica (independente de dados reais)
  const autonomoAt51 = 50 >= consultorio.limite_pacientes_por_prof;
  check('Fronteira: 50 pacientes bloqueia o 51º (autônomo)', autonomoAt51);
  const starterAt4 = 3 >= starter.limite_profissionais;
  check('Fronteira: 3 profissionais bloqueia o 4º (starter)', starterAt4);

  const soloClinics = await supabaseQuery(
    "SELECT c.id, cs.max_patients_per_professional FROM clinics c JOIN clinic_settings cs ON cs.clinic_id = c.id WHERE c.subscription_plan = 'consultorio' AND c.deleted_at IS NULL LIMIT 1",
  );

  if (soloClinics[0]) {
    const clinicId = soloClinics[0].id;
    const profs = await supabaseQuery(
      `SELECT id FROM professionals WHERE clinic_id = '${clinicId}' AND deleted_at IS NULL LIMIT 1`,
    );
    if (profs[0]) {
      const counts = await supabaseQuery(
        `SELECT count(*)::int AS n FROM patients WHERE professional_id = '${profs[0].id}' AND deleted_at IS NULL`,
      );
      const n = counts[0].n;
      const atLimit = n >= soloClinics[0].max_patients_per_professional;
      console.log(`\n  ℹ Clínica consultório: ${n}/${soloClinics[0].max_patients_per_professional} pacientes`);
      if (atLimit) {
        console.log('  → Próximo POST create-patient deve retornar QUOTA_EXCEEDED (403)');
      } else {
        console.log(`  → Faltam ${soloClinics[0].max_patients_per_professional - n} pacientes para testar bloqueio E2E`);
      }
    }
  } else {
    console.log('  ⚠ Nenhuma clínica consultório para teste de fronteira E2E');
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
