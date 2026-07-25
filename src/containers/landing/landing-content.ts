/**
 * Conteúdo da landing page — copy centralizada para fácil iteração de marketing.
 */

export interface LandingPillar {
  id: string;
  icon: 'brain' | 'home' | 'shield' | 'mic' | 'file' | 'calendar' | 'paperclip' | 'chat';
  title: string;
  description: string;
}

export const HERO = {
  badge: 'LGPD-ready · Dados isolados por paciente · IA que não treina modelos públicos',
  titleLines: ['O cuidado humano,', 'potencializado', 'por tecnologia.'],
  subtitle:
    'Uma IA copiloto — não substituta. Acompanhe a rotina da criança entre uma sessão e outra, construa relatórios e hipóteses diagnósticas com apoio da IA, e decida com transparência o que compartilhar com a família. Pensado para terapeutas de crianças com TEA, TDAH e outras demandas do desenvolvimento.',
  trustMarkers: ['Sigilo absoluto', 'IA que debate com você', 'Rotina da criança em tempo real'],
};

export const PILLARS: LandingPillar[] = [
  {
    id: 'copiloto',
    icon: 'brain',
    title: 'Copiloto, nunca substituto do terapeuta',
    description:
      'A IA sugere hipóteses, organiza dados e monta rascunhos de relatórios e diagnósticos — mas quem decide é você. Debata os resultados diretamente com a IA, questione, refine e aprove. Sua autonomia clínica fica intacta.',
  },
  {
    id: 'rotina',
    icon: 'home',
    title: 'A rotina da criança entre uma sessão e outra',
    description:
      'A maior dor do terapeuta de TEA e TDAH é não saber o que aconteceu com a criança durante a semana. A família registra crises, sono, alimentação e marcos pelo app — você chega para a sessão sabendo exatamente o que tratar.',
  },
  {
    id: 'transparencia',
    icon: 'shield',
    title: 'Transparência sob seu controle',
    description:
      'Cada relatório clínico tem um interruptor: você decide o que a família vê e o que permanece técnico. LGPD-ready, dados isolados por paciente, e nenhum dado da criança é usado para treinar modelos públicos.',
  },
];

export const STEPS = [
  {
    number: '01',
    actor: 'A Família',
    title: 'Rotina em Casa',
    description:
      'Durante a semana, pais e cuidadores registram no celular o que aconteceu com a criança: sono, alimentação, crises, hiperfocos, marcos e comportamentos — em poucos toques.',
    icon: 'home' as const,
  },
  {
    number: '02',
    actor: 'O Copiloto',
    title: 'IA que Correlaciona',
    description:
      'A IA cruza os registros de casa com o histórico clínico, resume a semana, aponta padrões e prepara hipóteses para você discutir — sem tomar decisões pelo terapeuta.',
    icon: 'brain' as const,
  },
  {
    number: '03',
    actor: 'O Terapeuta',
    title: 'Sessão com Contexto',
    description:
      'Você chega na consulta sabendo o que aconteceu, debate os achados com a IA, dita a evolução por áudio e escolhe o que compartilhar com a família no relatório final.',
    icon: 'mic' as const,
  },
];

export const FEATURES: LandingPillar[] = [
  {
    id: 'copiloto-chat',
    icon: 'chat',
    title: 'Copiloto que debate o caso com você',
    description:
      'Converse com a IA sobre cada paciente, com contexto isolado e seguro. Questione hipóteses, peça planos de sessão e salve os artefatos direto no prontuário.',
  },
  {
    id: 'ditado',
    icon: 'mic',
    title: 'Ditado pós-sessão por áudio',
    description:
      'Fale o que aconteceu na sessão e receba a evolução clínica estruturada em segundos. Você revisa, ajusta e aprova — a papelada desaparece.',
  },
  {
    id: 'anexos',
    icon: 'paperclip',
    title: 'Laudos e anexos lidos pela IA',
    description:
      'Suba avaliações, laudos e PDFs no prontuário. A IA lê, resume e transforma tudo em contexto pesquisável — nada se perde na gaveta.',
  },
  {
    id: 'diario',
    icon: 'home',
    title: 'Diário familiar com check-ins',
    description:
      'Sono, alimentação, medicação, crises e episódios sensoriais registrados pela família no celular — resumidos e priorizados pela IA para você em segundos.',
  },
  {
    id: 'agenda',
    icon: 'calendar',
    title: 'Agenda integrada ao caso',
    description:
      'Calendário semanal do consultório e terapias agendadas visíveis para a família, com lembretes automáticos. Menos faltas, mais continuidade.',
  },
  {
    id: 'relatorios',
    icon: 'file',
    title: 'Relatórios PDF profissionais',
    description:
      'Ficha clínica, evoluções e resumos exportados em PDF com seus dados profissionais. Os pais recebem o documento no mesmo dia, com a sua assinatura.',
  },
];

export const WHY_ITEMS: LandingPillar[] = [
  {
    id: 'autonomia',
    icon: 'brain',
    title: 'Autonomia clínica preservada',
    description:
      'A IA propõe, você decide. Debata hipóteses, questione relatórios, refine diagnósticos — o julgamento clínico e a assinatura continuam sendo seus.',
  },
  {
    id: 'continuidade',
    icon: 'home',
    title: 'Continuidade entre casa e consultório',
    description:
      'Chega de perguntar aos pais o que aconteceu na semana. O histórico chega organizado, priorizado e correlacionado com o plano terapêutico.',
  },
  {
    id: 'controle',
    icon: 'shield',
    title: 'Transparência que você controla',
    description:
      'Escolha o que compartilhar com a família em cada relatório. A confiança dos pais cresce sem que você perca o controle técnico do caso.',
  },
];

export const TESTIMONIALS = [
  {
    quote:
      'Reduzi 8h/semana de papelada. Hoje saio do consultório com o relatório pronto e os pais recebem o PDF no mesmo dia.',
    name: 'Dra. Marina Lopes',
    role: 'Psicóloga ABA autônoma · São Paulo',
  },
  {
    quote:
      'Consegui dobrar minha agenda sem perder qualidade. A IA organiza a evolução de cada paciente e eu chego pronta para a próxima sessão.',
    name: 'T.O. Camila Menezes',
    role: 'Terapeuta Ocupacional autônoma · Belo Horizonte',
  },
  {
    quote:
      'Os pais aderiram ao diário em dias. O engajamento subiu e cancelamos menos sessões — a continuidade ficou óbvia.',
    name: 'Fga. Beatriz Rocha',
    role: 'Fonoaudióloga autônoma · Rio de Janeiro',
  },
];

import {
  THERAPIST_PLANS,
  THERAPIST_PLAN_IDS,
  formatBRL,
  yearlyTotalCents,
} from '../../shared/lib/therapist-plans';

export interface LandingPlan {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: string;
  annualPrice: string;
  annualTotal: string | null;
  features: string[];
  cta: string;
  highlighted?: boolean;
  isFree?: boolean;
}

/** Planos reais da plataforma — fonte única: shared/lib/therapist-plans.ts */
export const PLANS: LandingPlan[] = THERAPIST_PLAN_IDS.map((planId) => {
  const plan = THERAPIST_PLANS[planId];
  const total = yearlyTotalCents(plan);
  return {
    id: plan.id,
    name: plan.nome,
    tagline: plan.descricao,
    monthlyPrice: plan.monthlyCents === 0 ? 'Grátis' : `${formatBRL(plan.monthlyCents)}`,
    annualPrice:
      plan.yearlyMonthlyCents === null ? 'Grátis' : `${formatBRL(plan.yearlyMonthlyCents)}`,
    annualTotal: total === null ? null : formatBRL(total),
    features: plan.features,
    cta: plan.id === 'free' ? 'Criar conta grátis' : `Assinar ${plan.nome}`,
    highlighted: plan.destaque,
    isFree: plan.id === 'free',
  };
});

export const FAQS = [
  {
    question: 'A IA vai substituir meu julgamento clínico?',
    answer:
      'Não. A Unithery foi desenhada como copiloto: a IA organiza dados, sugere hipóteses, monta rascunhos de relatório e diagnóstico — e você debate, questiona e aprova. Toda decisão clínica, assinatura e conduta permanecem 100% do terapeuta.',
  },
  {
    question: 'A plataforma é só para TEA e TDAH?',
    answer:
      'Não. A Unithery foi pensada a partir das dores de terapeutas de TEA e TDAH, mas atende qualquer demanda do desenvolvimento infantil: fonoaudiologia, terapia ocupacional, psicopedagogia, psicologia clínica e equipes multidisciplinares. O prontuário, o diário familiar e o copiloto se adaptam ao seu plano terapêutico.',
  },
  {
    question: 'Posso escolher o que compartilhar com a família?',
    answer:
      'Sim, e esse é um dos pilares da plataforma. Cada relatório e observação tem um controle de visibilidade: você decide o que vai para o portal da família e o que permanece técnico, restrito ao prontuário interno. Nada é compartilhado sem a sua aprovação explícita.',
  },
  {
    question: 'Como a Unithery garante a conformidade com a LGPD?',
    answer:
      'Os dados trafegam criptografados e ficam isolados por paciente — a IA de um caso nunca acessa dados de outro. A Unithery atua como Operadora de Dados: as informações clínicas pertencem exclusivamente a você, e nenhum dado é usado para treinar modelos públicos ou fins comerciais.',
  },
  {
    question: 'Preciso instalar algo? Funciona no celular?',
    answer:
      'Nada de instalação. O painel do terapeuta roda em qualquer navegador, e a família usa um app leve no celular (PWA) — basta abrir o link do convite e criar o acesso. Tudo sincronizado em tempo real.',
  },
  {
    question: 'Existe período de teste?',
    answer:
      'Sim, em duas camadas. Ao criar a conta você entra no Plano Free (1 paciente, 4 sessões/mês e copiloto de IA incluído) — sem cartão e sem prazo. E ao assinar qualquer plano pago pela primeira vez, você ganha 14 dias grátis: cadastra o cartão, não paga nada no período e pode cancelar a qualquer momento antes da primeira cobrança, direto na plataforma.',
  },
  {
    question: 'Como funciona o plano anual? Posso cancelar?',
    answer:
      'O plano anual dá 12% de desconto e é cobrado em 12 parcelas mensais no cartão, com compromisso de 12 meses. Você pode cancelar quando quiser (a lei garante): nesse caso, os meses já utilizados são recalculados ao preço mensal cheio — você só devolve o desconto, sem outras multas. O cancelamento e a remoção do cartão são feitos em dois cliques, em Configurações → Plano.',
  },
];

export const STATS = [
  { value: '8h+', label: 'economizadas por semana, por terapeuta' },
  { value: '+38%', label: 'de engajamento das famílias' },
  { value: '100%', label: 'do histórico técnico fica com você' },
];

export const TIMELINE_PREVIEW = [
  { time: 'Hoje · 07:12', title: 'Diário da mãe', detail: 'Acordou 2x, café sem proteína.' },
  { time: 'Ontem · 19:40', title: 'Hiperfoco', detail: 'Dinossauros (T-Rex).' },
  { time: 'Sessão anterior', title: 'Fechamento', detail: 'Avançou meta A, fadiga na meta B.' },
];
