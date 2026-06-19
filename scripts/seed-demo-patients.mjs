/**
 * Seed — 10 pacientes fictícios para conta de demonstração/testes.
 *
 * Uso: node --env-file=.env scripts/seed-demo-patients.mjs
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const EMAIL = (process.env.SEED_EMAIL ?? 'joao@synes.tech').trim().toLowerCase();
const PASSWORD = process.env.SEED_PASSWORD ?? '123456';

function calcCpfDigit(base, factor) {
  let sum = 0;
  for (let i = 0; i < base.length; i++) sum += Number(base[i]) * (factor - i);
  const mod = (sum * 10) % 11;
  return mod === 10 ? 0 : mod;
}

function makeValidCpf(seed) {
  const base = String(seed).padStart(9, '0').slice(0, 9);
  const d1 = calcCpfDigit(base, 10);
  const d2 = calcCpfDigit(base + d1, 11);
  return base + String(d1) + String(d2);
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

/** Pacientes fictícios com anamnese variada para testes de UI e copiloto. */
const DEMO_PATIENTS = [
  {
    possui_cpf_proprio: false,
    cpf_responsavel: makeValidCpf(100200300),
    nome_responsavel: 'Patrícia Mendes',
    name: 'Lucas Mendes',
    birth_date: '2017-04-12',
    gender: 'male',
    diagnoses: ['TEA', 'Atraso na fala'],
    clinical_observations:
      'Criança verbal com ecolalia. Boa interação com figuras de interesse (dinossauros). Sensibilidade moderada a ruídos.',
    queixa_principal:
      'Pais relatam dificuldade em rotinas escolares e birras ao mudar de atividade. Busca apoio para comunicação funcional.',
    medicamentos: 'Nenhum medicamento contínuo no momento.',
    escolaridade_ocupacao: '2º ano do ensino fundamental — escola regular com apoio.',
    composicao_familiar: 'Mãe, pai e irmã mais nova (3 anos). Moram em apartamento.',
    responsaveis: 'Patrícia Mendes (mãe, contato principal) e Ricardo Mendes (pai).',
    objetivos_terapeuticos:
      'Ampliar comunicação funcional, reduzir crises em transições e fortalecer habilidades sociais em pares.',
    hiperfocos_interesses: 'Dinossauros, mapas do metrô, vídeos educativos de ciência.',
    acompanhamento_multi: ['Fonoaudiologia', 'Terapia ocupacional'],
    informacoes_adicionais:
      'Família engajada. Preferência por atividades visuais e rotina pictográfica.',
  },
  {
    possui_cpf_proprio: false,
    cpf_responsavel: makeValidCpf(200300400),
    nome_responsavel: 'Carla Santos',
    name: 'Maria Clara Santos',
    birth_date: '2019-08-03',
    gender: 'female',
    diagnoses: ['TDAH'],
    clinical_observations:
      'Alta energia motora, dificuldade de manter atenção em tarefas longas. Afetividade preservada.',
    queixa_principal:
      'Desatenção em sala de aula, impulsividade em brincadeiras e dificuldade para iniciar tarefas domésticas.',
    medicamentos: 'Metilfenidato 10mg — uso matinal sob acompanhamento pediátrico.',
    escolaridade_ocupacao: 'Educação infantil — último ano.',
    composicao_familiar: 'Mãe solo, avó materna no mesmo lar.',
    responsaveis: 'Carla Santos (mãe).',
    objetivos_terapeuticos:
      'Desenvolver autorregulação, estratégias de foco e rotinas de sono mais estáveis.',
    hiperfocos_interesses: 'Desenhos animados, culinária lúdica, dança.',
    acompanhamento_multi: ['Psicopedagogia'],
    informacoes_adicionais: 'Responde bem a reforço positivo e timers visuais.',
  },
  {
    possui_cpf_proprio: true,
    cpf_paciente: makeValidCpf(300400500),
    name: 'Rafael Oliveira',
    birth_date: '2013-11-22',
    gender: 'male',
    diagnoses: ['TEA', 'TDAH'],
    clinical_observations:
      'Perfil intelectual dentro da média. Uso de fones em ambientes ruidosos. Interesse intenso por programação.',
    queixa_principal:
      'Dificuldades de organização escolar, ansiedade antes de provas e isolamento em recreio.',
    medicamentos: 'Não faz uso contínuo.',
    escolaridade_ocupacao: '7º ano — escola pública.',
    composicao_familiar: 'Pais casados, irmão mais velho (16 anos).',
    responsaveis: 'Fernanda e Marcos Oliveira.',
    objetivos_terapeuticos:
      'Habilidades de planejamento, manejo de ansiedade social e autonomia em demandas escolares.',
    hiperfocos_interesses: 'Programação em Scratch, jogos de estratégia, astronomia.',
    acompanhamento_multi: ['Neuropediatria'],
    informacoes_adicionais: 'Participa de clube de robótica aos sábados.',
  },
  {
    possui_cpf_proprio: false,
    cpf_responsavel: makeValidCpf(400500600),
    nome_responsavel: 'Juliana Ferreira',
    name: 'Sofia Ferreira',
    birth_date: '2021-02-14',
    gender: 'female',
    diagnoses: ['Atraso no desenvolvimento'],
    clinical_observations:
      'Marcha adquirida com 18 meses. Vocabulário emergente. Boa resposta a estímulos musicais.',
    queixa_principal:
      'Atraso na fala e na coordenação motora fina. Pais buscam estimulação precoce integrada.',
    medicamentos: 'Suplementação de vitamina D conforme pediatra.',
    escolaridade_ocupacao: 'Berçário — meio período.',
    composicao_familiar: 'Pais, sem irmãos.',
    responsaveis: 'Juliana Ferreira (mãe) e André Ferreira (pai).',
    objetivos_terapeuticos:
      'Estimular linguagem expressiva, coordenação motora e brincar simbólico.',
    hiperfocos_interesses: 'Música infantil, blocos de montar, banho de mangueira.',
    acompanhamento_multi: ['Fonoaudiologia', 'Fisioterapia', 'Terapia ocupacional'],
    informacoes_adicionais: 'Primeira consulta na clínica; histórico de otite de repetição na infância.',
  },
  {
    possui_cpf_proprio: true,
    cpf_paciente: makeValidCpf(500600700),
    name: 'Tiago Almeida',
    birth_date: '2010-06-30',
    gender: 'male',
    diagnoses: ['Transtorno de ansiedade'],
    clinical_observations:
      'Queixas somáticas (dor abdominal) em períodos de prova. Autocrítica elevada.',
    queixa_principal:
      'Ansiedade antecipatória, dificuldade para dormir antes de eventos escolares e perfeccionismo.',
    medicamentos: 'Não utiliza.',
    escolaridade_ocupacao: '9º ano — cursinho preparatório aos sábados.',
    composicao_familiar: 'Pais separados, alternância de lares a cada quinzena.',
    responsaveis: 'Mãe: Renata Almeida. Pai: Paulo Almeida.',
    objetivos_terapeuticos:
      'Técnicas de regulação emocional, reestruturação cognitiva e rotina de sono.',
    hiperfocos_interesses: 'Futebol, leitura de fantasia, edição de vídeos.',
    acompanhamento_multi: [],
    informacoes_adicionais: 'Deseja retomar atividade esportiva após pausa por lesão leve.',
  },
  {
    possui_cpf_proprio: false,
    cpf_responsavel: makeValidCpf(600700800),
    nome_responsavel: 'Amanda Lima',
    name: 'Beatriz Lima',
    birth_date: '2016-09-05',
    gender: 'female',
    diagnoses: ['TDAH', 'Deficit de aprendizagem'],
    clinical_observations:
      'Dificuldade persistente em leitura e escrita. Criativa e comunicativa em contextos informais.',
    queixa_principal:
      'Baixo rendimento em português e matemática apesar de esforço. Frustração com lição de casa.',
    medicamentos: 'Avaliação medicamentosa em andamento.',
    escolaridade_ocupacao: '3º ano — reforço escolar 2x/semana.',
    composicao_familiar: 'Mãe, padrasto e meio-irmão (1 ano).',
    responsaveis: 'Amanda Lima (mãe).',
    objetivos_terapeuticos:
      'Estratégias de estudo, autoestima acadêmica e manejo de frustração.',
    hiperfocos_interesses: 'Artes plásticas, histórias em quadrinhos, animais.',
    acompanhamento_multi: ['Psicopedagogia', 'Neuropediatria'],
    informacoes_adicionais: 'Laudo psicopedagógico de 2024 arquivado pela família.',
  },
  {
    possui_cpf_proprio: false,
    cpf_responsavel: makeValidCpf(700800900),
    nome_responsavel: 'Roberto Costa',
    name: 'Enzo Costa',
    birth_date: '2018-01-18',
    gender: 'male',
    diagnoses: ['TEA'],
    nome_social: 'Enzo',
    clinical_observations:
      'Diagnóstico confirmado aos 4 anos. Comunicação por pictogramas e frases curtas.',
    queixa_principal:
      'Seletividade alimentar acentuada e rigidez em rotinas de higiene.',
    medicamentos: 'Melatonina 1mg à noite — prescrição pediátrica.',
    escolaridade_ocupacao: '1º ano — sala de recursos em parte do dia.',
    composicao_familiar: 'Pais e irmão gêmeo sem diagnóstico.',
    responsaveis: 'Roberto Costa (pai) e Luciana Costa (mãe).',
    objetivos_terapeuticos:
      'Ampliar repertório alimentar, flexibilidade cognitiva e independência em autocuidado.',
    hiperfocos_interesses: 'Trens, relógios, ordem e classificação de objetos.',
    acompanhamento_multi: ['Terapia ocupacional', 'Nutricionista'],
    informacoes_adicionais: 'Irmão gêmeo frequenta mesma escola — dinâmica familiar complexa.',
  },
  {
    possui_cpf_proprio: true,
    cpf_paciente: makeValidCpf(800900100),
    name: 'Isabella Rodrigues',
    birth_date: '2014-12-07',
    gender: 'female',
    diagnoses: ['Transtorno de aprendizagem', 'Ansiedade'],
    clinical_observations:
      'Boa participação em aulas de artes. Evita leitura em voz alta na turma.',
    queixa_principal:
      'Trocas de letras na escrita, bloqueio em avaliações orais e medo de errar em público.',
    medicamentos: 'Não utiliza.',
    escolaridade_ocupacao: '6º ano — ensino fundamental.',
    composicao_familiar: 'Família nuclear — pais e irmã mais nova.',
    responsaveis: 'Mariana Rodrigues (mãe).',
    objetivos_terapeuticos:
      'Reduzir ansiedade de desempenho e consolidar estratégias compensatórias de leitura.',
    hiperfocos_interesses: 'Teatro escolar, pintura em aquarela, gatos.',
    acompanhamento_multi: ['Psicopedagogia'],
    informacoes_adicionais: 'Participou de peça teatral da escola no ano passado.',
  },
  {
    possui_cpf_proprio: false,
    cpf_responsavel: makeValidCpf(900100200),
    nome_responsavel: 'Vanessa Pereira',
    name: 'Gabriel Pereira',
    birth_date: '2020-05-25',
    gender: 'male',
    diagnoses: ['TEA', 'Seletividade alimentar'],
    clinical_observations:
      'Contato visual intermitente. Boa habilidade visual para quebra-cabeças.',
    queixa_principal:
      'Ainda não verbaliza palavras funcionais. Família busca orientação para introdução alimentar.',
    medicamentos: 'Nenhum.',
    escolaridade_ocupacao: 'Ainda não matriculado — estimulação em casa.',
    composicao_familiar: 'Mãe, pai trabalhador em turno noturno, avó colabora no cuidado.',
    responsaveis: 'Vanessa Pereira (mãe).',
    objetivos_terapeuticos:
      'Comunicação alternativa, integração sensorial e expansão alimentar gradual.',
    hiperfocos_interesses: 'Carros de brinquedo, encaixes, vídeos de abertura de embalagens.',
    acompanhamento_multi: ['Fonoaudiologia', 'Terapia ocupacional'],
    informacoes_adicionais: 'Aceita apenas 8 alimentos na dieta atual.',
  },
  {
    possui_cpf_proprio: true,
    cpf_paciente: makeValidCpf(110120130),
    name: 'Helena Nunes',
    birth_date: '2015-10-11',
    gender: 'female',
    diagnoses: ['TOC', 'Ansiedade'],
    clinical_observations:
      'Rituais de verificação antes de dormir (portas, luzes). Insight parcial sobre comportamentos.',
    queixa_principal:
      'Demora excessiva para tarefas cotidianas por checagens repetidas. Impacto no sono da família.',
    medicamentos: 'Avaliação psiquiátrica agendada.',
    escolaridade_ocupacao: '4º ano — boa adaptação escolar apesar dos rituais em casa.',
    composicao_familiar: 'Pais, irmão (8 anos).',
    responsaveis: 'Cláudia Nunes (mãe) e Eduardo Nunes (pai).',
    objetivos_terapeuticos:
      'Exposição gradual com prevenção de resposta e redução de rituais noturnos.',
    hiperfocos_interesses: 'Leitura, organização de coleções, natação.',
    acompanhamento_multi: [],
    informacoes_adicionais: 'Histórico de TOC materno leve — família conhece o quadro.',
  },
];

async function main() {
  if (!URL || !ANON) {
    console.error('Defina SUPABASE_URL e SUPABASE_ANON_KEY no .env');
    process.exit(1);
  }

  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signErr } = await client.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  if (signErr || !signIn?.session) {
    console.error(`Falha no login (${EMAIL}):`, signErr?.message ?? 'sem sessão');
    process.exit(1);
  }

  const token = signIn.session.access_token;
  console.log(`\n✓ Login OK — ${EMAIL}\n`);

  const listBefore = await callFn('list-patients', token, { limit: 200 });
  const existing = listBefore.json?.data ?? [];
  console.log(`Pacientes ativos antes: ${existing.length}\n`);

  const created = [];
  const errors = [];

  for (const patient of DEMO_PATIENTS) {
    const res = await callFn('create-patient', token, patient);
    if (res.status === 201 && res.json?.data?.patient_id) {
      created.push({
        id: res.json.data.patient_id,
        name: patient.name,
        diagnoses: patient.diagnoses,
      });
      console.log(`  ✅ ${patient.name} — ${patient.diagnoses.join(', ')}`);
    } else {
      const msg = res.json?.error?.message ?? JSON.stringify(res.json?.error ?? res.json);
      errors.push({ name: patient.name, status: res.status, msg });
      console.log(`  ❌ ${patient.name} — HTTP ${res.status}: ${msg}`);
    }
  }

  const listAfter = await callFn('list-patients', token, { limit: 200 });
  const total = listAfter.json?.data?.length ?? '?';

  console.log('\n═══ Resumo ═══');
  console.log(`Criados nesta execução: ${created.length}/${DEMO_PATIENTS.length}`);
  console.log(`Total na lista agora: ${total}`);
  if (errors.length > 0) {
    console.log(`Falhas: ${errors.length}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
