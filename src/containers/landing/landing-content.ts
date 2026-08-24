/**
 * Conteúdo da landing — copy alinhada ao layout de marketing.
 */

export type LandingIcon =
  | 'sparkle'
  | 'lock'
  | 'shield'
  | 'flask'
  | 'phone'
  | 'sync'
  | 'people'
  | 'book'
  | 'paperclip'
  | 'chat'
  | 'mic'
  | 'calendar'
  | 'file'
  | 'scales'
  | 'link'
  | 'eye'
  | 'clock'
  | 'card'
  | 'cardSlash'
  | 'check'
  | 'trend';

export interface LandingItem {
  id: string;
  icon: LandingIcon;
  title: string;
  description: string;
}

export const HERO = {
  badge: 'Uma IA copiloto, não substituta',
  titleBefore: 'O cuidado ',
  titleEmphasis: 'continua',
  titleAfter: ' entre as sessões.',
  lead: 'A criança não conta como foi a semana. A família conta.',
  body: 'Sono, crises, hiperfocos, marcos. Tudo registrado antes de você abrir a porta do consultório. Você decide o que fazer com isso: aprova, questiona, ajusta. A IA organiza; quem trata é você.',
  audience: 'Feito para terapeutas de crianças com TEA, TDAH e outras demandas do desenvolvimento.',
  cta: 'Começar teste gratuito',
  trustMarkers: ['Sigilo absoluto', 'IA que debate com você', 'Rotina da criança em tempo real'],
};

export const TIMELINE_PREVIEW = [
  {
    time: 'Início da semana',
    title: 'Diário da família',
    detail: 'Domingo: sono irregular. Segunda começou sem rotina no café.',
  },
  {
    time: 'Ontem · 19:40',
    title: 'Hiperfoco',
    detail: 'Dinossauros (T-Rex) por 2h. Pulou o lanche da tarde.',
  },
  {
    time: 'Hoje · 07:12',
    title: 'Diário da mãe',
    detail: 'Acordou 2x. Café sem proteína. Medicação atrasou 40 min.',
  },
];

export const TIMELINE_INSIGHT = {
  kicker: 'Insight da IA',
  title: 'Padrão detectado:',
  detail: 'crises após atraso na medicação.',
};

export const TIMELINE_DECISION = {
  kicker: 'Sua decisão',
  title: 'Você define a conduta.',
  detail:
    'Cruza o diário e o insight. Aprova, questiona ou ajusta. A IA sugere; a palavra final é sua.',
};

export const PILLARS: LandingItem[] = [
  {
    id: 'lgpd',
    icon: 'lock',
    title: 'LGPD-ready',
    description: 'Dados criptografados em trânsito e tratados conforme a lei.',
  },
  {
    id: 'isolamento',
    icon: 'shield',
    title: 'Dados isolados por paciente',
    description: 'A IA de um caso nunca acessa os dados de outro.',
  },
  {
    id: 'treino',
    icon: 'flask',
    title: 'IA que não treina modelos públicos',
    description: 'Nenhum dado da criança vira treino para terceiros.',
  },
];

export const STEPS = [
  {
    number: '01',
    actor: 'A Família',
    title: 'Rotina em Casa',
    description:
      'Durante a semana, pais e cuidadores registram no celular o que aconteceu com a criança: sono, alimentação, crises, hiperfocos, marcos e comportamentos — em poucos toques.',
    icon: 'phone' as const,
  },
  {
    number: '02',
    actor: 'O Copiloto',
    title: 'IA que Correlaciona',
    description:
      'A IA cruza os registros de casa com o histórico clínico, resume a semana, aponta padrões e prepara hipóteses para você discutir — sem tomar decisões pelo terapeuta.',
    icon: 'sync' as const,
  },
  {
    number: '03',
    actor: 'O Terapeuta',
    title: 'Sessão com Contexto',
    description:
      'Você chega na consulta sabendo o que aconteceu, debate os achados com a IA, dita a evolução por áudio e escolhe o que compartilhar com a família no relatório final.',
    icon: 'people' as const,
  },
];

export interface LandingFeature {
  id: string;
  icon: LandingIcon;
  /** Título curto — usado no card compacto e na aba do carrossel. */
  title: string;
  /** Uma linha para o card compacto. */
  short: string;
  eyebrow: string;
  description: string;
  points: string[];
}

export const FEATURES: LandingFeature[] = [
  {
    id: 'diario',
    icon: 'book',
    title: 'Diário familiar',
    short: 'A semana da criança registrada em casa, no celular.',
    eyebrow: 'Rotina da casa',
    description:
      'Sono, alimentação, medicação, crises e episódios sensoriais registrados pela família no celular — resumidos e priorizados pela IA para você em segundos.',
    points: [
      'Check-ins de poucos toques, sem formulário longo',
      'Cada dia da semana com o que realmente importa',
      'Resumo da IA pronto antes da próxima sessão',
    ],
  },
  {
    id: 'anexos',
    icon: 'paperclip',
    title: 'Laudos lidos pela IA',
    short: 'Avaliações e PDFs viram contexto pesquisável.',
    eyebrow: 'Prontuário inteligente',
    description:
      'Suba avaliações, laudos e PDFs no prontuário. A IA lê, resume e transforma tudo em contexto pesquisável — nada se perde na gaveta.',
    points: [
      'Leitura automática de laudos e relatórios externos',
      'Pontos-chave extraídos e vinculados ao caso',
      'Busca por sintoma, conduta ou profissional',
    ],
  },
  {
    id: 'copiloto-chat',
    icon: 'chat',
    title: 'IA personalizada para cada paciente',
    short: 'Hipóteses que nascem do prontuário isolado.',
    eyebrow: 'Copiloto clínico',
    description:
      'A inteligência se adapta ao contexto único de cada caso e à sua abordagem clínica. Hipóteses, sínteses e planos nascem do prontuário isolado — não de um modelo genérico.',
    points: [
      'Contexto isolado por paciente, sempre',
      'Debata, questione e refine cada sugestão',
      'A palavra final da conduta continua sendo sua',
    ],
  },
  {
    id: 'ditado',
    icon: 'mic',
    title: 'Ditado pós-sessão',
    short: 'Fale a sessão; a evolução sai estruturada.',
    eyebrow: 'Fim da papelada',
    description:
      'Fale o que aconteceu na sessão e receba a evolução clínica estruturada em segundos. Você revisa, ajusta e aprova — a papelada desaparece.',
    points: [
      'Gravação direto do navegador, sem instalar nada',
      'Transcrição e estruturação em segundos',
      'Rascunho só vira registro depois da sua aprovação',
    ],
  },
  {
    id: 'agenda',
    icon: 'calendar',
    title: 'Agenda integrada ao caso',
    short: 'Semana do consultório com lembretes automáticos.',
    eyebrow: 'Agenda e presença',
    description:
      'Calendário semanal do consultório e terapias agendadas visíveis para a família, com lembretes automáticos. Menos faltas, mais continuidade.',
    points: [
      'Visão de semana com todos os atendimentos',
      'Lembrete automático por e-mail para a família',
      'Remarcação sem perder o histórico do caso',
    ],
  },
  {
    id: 'relatorios',
    icon: 'file',
    title: 'Relatórios PDF profissionais',
    short: 'Documento com a sua identidade, no mesmo dia.',
    eyebrow: 'Entrega para a família',
    description:
      'Ficha clínica, evoluções e resumos exportados em PDF com seus dados profissionais. Os pais recebem o documento no mesmo dia, com a sua assinatura.',
    points: [
      'Você escolhe o que é técnico e o que vai para a família',
      'Layout pronto, com seus dados e registro profissional',
      'Envio no mesmo dia, direto do prontuário',
    ],
  },
  {
    id: 'financeiro',
    icon: 'trend',
    title: 'Gestão financeira',
    short: 'Honorários, receitas e inadimplência num painel.',
    eyebrow: 'Módulo financeiro',
    description:
      'O terapeuta administra o caixa do consultório sem planilha à parte: honorário da sessão, títulos a receber e o que já entrou no mês — no mesmo recorte da agenda.',
    points: [
      'Avulso, mensalidade ou pacote viram título automaticamente',
      'Recebido, a receber e atrasado sempre visíveis',
      'Baixa do honorário em um toque, caixa atualizado na hora',
    ],
  },
  {
    id: 'portal-familia',
    icon: 'people',
    title: 'Portal da família',
    short: 'Check-in diário do dia, do humor e das crises.',
    eyebrow: 'Continuidade em casa',
    description:
      'Em menos de um minuto a família conta como foi o dia: se foi bom ou difícil, o humor predominante e se houve crise. Quem preferir só fala — o áudio é transcrito e chega organizado no prontuário.',
    points: [
      'Como foi o dia, humor e crise em poucos toques',
      'Check-in por áudio para quem não quer digitar',
      'Chega no prontuário pronto para a próxima sessão',
    ],
  },
];

export type FinanceDemoStatus = 'PAGO' | 'PENDENTE' | 'ATRASADO';

export interface FinanceDemoItem {
  id: string;
  patient: string;
  plan: string;
  amountCents: number;
  due: string;
  status: FinanceDemoStatus;
}

/** Dados fictícios das demonstrações interativas do carrossel de funcionalidades. */
export const SHOWCASE_DEMO = {
  diario: {
    window: 'Diário · Ana M.',
    days: [
      {
        day: 'Seg',
        entries: [
          { label: 'Sono', detail: 'Dormiu 21h40, acordou 1x', tone: 'ok' as const },
          { label: 'Escola', detail: 'Dia tranquilo, sem queixas', tone: 'ok' as const },
        ],
        summary: 'Semana começou com rotina preservada.',
      },
      {
        day: 'Ter',
        entries: [
          { label: 'Hiperfoco', detail: 'Dinossauros por 2h', tone: 'warn' as const },
          { label: 'Lanche', detail: 'Pulou o lanche da tarde', tone: 'warn' as const },
        ],
        summary: 'Hiperfoco longo competiu com a alimentação.',
      },
      {
        day: 'Qua',
        entries: [
          { label: 'Medicação', detail: 'Atrasou 40 min', tone: 'alert' as const },
          { label: 'Crise', detail: 'Choro intenso às 18h', tone: 'alert' as const },
        ],
        summary: 'Atraso na medicação antecedeu a crise da tarde.',
      },
      {
        day: 'Qui',
        entries: [
          { label: 'Sono', detail: 'Noite inteira, sem despertar', tone: 'ok' as const },
          { label: 'Combinado', detail: 'Escovou os dentes sozinha', tone: 'ok' as const },
        ],
        summary: 'Dia de boa regulação e autonomia.',
      },
      {
        day: 'Sex',
        entries: [
          { label: 'Sensorial', detail: 'Incomodada com barulho na sala', tone: 'warn' as const },
          { label: 'Humor', detail: 'Cansada no fim do dia', tone: 'warn' as const },
        ],
        summary: 'Sobrecarga sensorial no fim da semana.',
      },
    ],
  },
  anexos: {
    window: 'Anexos · Ana M.',
    files: [
      {
        name: 'Laudo_neuropediatria.pdf',
        meta: '8 páginas · há 2 dias',
        insights: ['TEA nível 1 de suporte', 'Sono fragmentado desde os 4 anos', 'Sugerido apoio sensorial'],
      },
      {
        name: 'Avaliacao_TO.pdf',
        meta: '4 páginas · há 1 semana',
        insights: ['Hipersensibilidade auditiva', 'Coordenação fina em evolução', 'TO 2x por semana'],
      },
      {
        name: 'Relatorio_escola.pdf',
        meta: '2 páginas · há 3 semanas',
        insights: ['Melhor desempenho em rotina previsível', 'Dificuldade em trocas de atividade'],
      },
    ],
  },
  copiloto: {
    window: 'Copiloto · Ana M.',
    threads: [
      {
        question: 'O que mudou desde a última sessão?',
        answer: 'Duas crises na semana, ambas até 90 min após atraso na medicação. Sono estável nos outros dias.',
        tag: 'Padrão detectado',
      },
      {
        question: 'Sugere uma atividade para casa.',
        answer: 'Quadro visual de rotina da manhã, com a medicação como primeiro passo antes do café.',
        tag: 'Plano sugerido',
      },
      {
        question: 'Resuma para a família.',
        answer: 'Semana boa no sono. Vale reforçar o horário da medicação para reduzir as crises do fim do dia.',
        tag: 'Linguagem da família',
      },
    ],
  },
  ditado: {
    window: 'Ditado pós-sessão',
    lines: [
      'Ana chegou agitada, relatou barulho na escola.',
      'Trabalhamos regulação com o kit sensorial.',
      'Combinamos quadro visual da rotina da manhã.',
    ],
    note: {
      subjective: 'Relato de sobrecarga sensorial na escola.',
      plan: 'Quadro visual da rotina + revisão do horário da medicação.',
    },
    time: '12s',
  },
  agenda: {
    window: 'Agenda da semana',
    days: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
    slots: [
      { day: 0, time: '09h', patient: 'Pedro L.' },
      { day: 1, time: '14h', patient: 'Ana M.' },
      { day: 2, time: '10h', patient: 'Sofia R.' },
      { day: 3, time: '16h', patient: 'Lucas T.' },
      { day: 4, time: '11h', patient: 'Helena C.' },
    ],
    reminder: 'Lembrete enviado à família',
  },
  relatorios: {
    window: 'Relatório · Ana M.',
    title: 'Evolução clínica — Agosto',
    sections: [
      { label: 'Resumo da semana', shared: true },
      { label: 'Combinados de casa', shared: true },
      { label: 'Hipóteses técnicas', shared: false },
      { label: 'Plano terapêutico', shared: false },
    ],
    sent: 'PDF enviado à família',
  },
  portal: {
    window: 'Check-in diário · família',
    question: 'Como foi o dia da Ana hoje?',
    moods: [
      { id: 'bom', label: 'Foi bom', tone: 'ok' as const },
      { id: 'oscilou', label: 'Oscilou', tone: 'warn' as const },
      { id: 'dificil', label: 'Foi difícil', tone: 'alert' as const },
    ],
    humorLabel: 'Humor predominante',
    humors: ['Calma', 'Irritada', 'Agitada', 'Retraída'],
    crisisLabel: 'Teve crise hoje?',
    crisisDetail: 'Choro intenso às 18h, durou 20 min',
    audio: {
      hint: 'Ou conte por áudio, do jeito que der',
      duration: '0:24',
      transcript:
        'Ela chegou da escola agitada, choramingou na hora do banho e melhorou depois do jantar.',
    },
    sent: 'Check-in enviado ao terapeuta',
  },
};

export const FINANCE_DEMO = {
  window: 'Caixa do consultório',
  monthLabel: 'Agosto de 2026',
  items: [
    { id: 'ana', patient: 'Ana M.', plan: 'Mensal', amountCents: 54000, due: '05/08', status: 'PAGO' as const },
    { id: 'pedro', patient: 'Pedro L.', plan: 'Avulso', amountCents: 18000, due: '12/08', status: 'PAGO' as const },
    { id: 'sofia', patient: 'Sofia R.', plan: 'Pacote', amountCents: 72000, due: '18/08', status: 'PENDENTE' as const },
    { id: 'lucas', patient: 'Lucas T.', plan: 'Mensal', amountCents: 54000, due: '08/08', status: 'ATRASADO' as const },
    { id: 'helena', patient: 'Helena C.', plan: 'Avulso', amountCents: 18000, due: '22/08', status: 'PENDENTE' as const },
  ] satisfies FinanceDemoItem[],
  trend: [
    { label: 'Mai', percent: 48 },
    { label: 'Jun', percent: 61 },
    { label: 'Jul', percent: 70 },
    { label: 'Ago', percent: 88 },
  ],
};

export const WHY_ITEMS: LandingItem[] = [
  {
    id: 'autonomia',
    icon: 'scales',
    title: 'Autonomia clínica preservada',
    description:
      'A IA propõe, você decide. Debata hipóteses, questione relatórios, refine seu plano terapêutico — o julgamento clínico e a assinatura continuam sendo seus.',
  },
  {
    id: 'continuidade',
    icon: 'link',
    title: 'Continuidade entre casa e consultório',
    description:
      'Chega de perguntar aos pais o que aconteceu na semana. O histórico chega organizado, priorizado e correlacionado com o plano terapêutico.',
  },
  {
    id: 'controle',
    icon: 'eye',
    title: 'Transparência que você controla',
    description:
      'Escolha o que compartilhar com a família em cada relatório. A confiança dos pais cresce sem que você perca o controle técnico do caso.',
  },
];

export const SOCIAL_PROOF = {
  eyebrow: 'Quem já usa',
  title: 'Veja como a Unithery mudou o dia a dia de quem já usa.',
  subtitle:
    'A IA se adapta ao contexto único de cada paciente e à abordagem do terapeuta — copiloto de precisão, não um modelo genérico.',
  testimonial: {
    quote:
      'A plataforma organiza a rotina clínica e centraliza informações que antes ficavam espalhadas. Gravo o áudio da sessão e já sai a evolução organizada, sem parar pra escrever depois. E o diário da família me dá uma visão muito mais completa da semana da criança. Com a IA fazendo a síntese de laudos e histórico, é uma ferramenta pensada de verdade pro dia a dia do terapeuta. Facilitou muito a minha rotina.',
    name: 'Livia S. Pavarini',
    role: 'Psicopedagoga clínica',
    initials: 'LP',
    photoAlt: 'Foto de Livia S. Pavarini',
    linkedinUrl: 'https://www.linkedin.com/in/livia-pavarini-376215315/',
  },
  stats: [
    {
      icon: 'clock' as const,
      value: '8h+',
      label: 'economizadas por semana, por terapeuta',
    },
    {
      icon: 'lock' as const,
      value: '100%',
      label: 'do histórico técnico fica com você',
    },
  ],
};

export interface LandingPaidPlan {
  id: string;
  name: string;
  tagline: string;
  monthlyLabel: string;
  yearlyLabel: string;
  yearlyTotalLabel: string;
  costPerPatientLabel: string;
  features: string[];
  cta: string;
}

export const PAID_PLANS: LandingPaidPlan[] = [
  {
    id: 'standard',
    name: 'Plano Standard',
    tagline: 'Para quem está começando ou com carteira enxuta',
    monthlyLabel: 'R$ 237,00',
    yearlyLabel: 'R$ 207,00',
    yearlyTotalLabel: 'R$ 2.484,00 à vista ou parcelado',
    costPerPatientLabel: 'Custo por paciente no plano',
    features: [
      'Atende até 10 pacientes ativos',
      'Copiloto de IA com integração com paciente',
      'Transcrição de sessões e relatórios compartilhados, com interação do seu copiloto de IA',
      'Inclusão de anexos e prontuários com interatividade da IA',
      'Diário familiar com áudios transcritos para o terapeuta em tempo real',
      'Compra adicional de pacote de pacientes a qualquer momento, dentro do seu acesso',
    ],
    cta: 'Assinar Standard',
  },
  {
    id: 'advanced',
    name: 'Plano Advanced',
    tagline: 'Para terapeutas com carteira consolidada',
    monthlyLabel: 'R$ 427,00',
    yearlyLabel: 'R$ 377,00',
    yearlyTotalLabel: 'R$ 4.524,00 à vista ou parcelado',
    costPerPatientLabel: 'Custo por paciente no plano',
    features: [
      'Atende de 11 a 20 pacientes ativos',
      'Copiloto de IA com integração com paciente',
      'Transcrição de sessões e relatórios compartilhados, com interação do seu copiloto de IA',
      'Inclusão de anexos e prontuários com interatividade da IA',
      'Diário familiar com áudios transcritos para o terapeuta em tempo real',
      'Compra adicional de pacote de pacientes a qualquer momento, dentro do seu acesso',
    ],
    cta: 'Assinar Advanced',
  },
  {
    id: 'premium',
    name: 'Plano Premium',
    tagline: 'Máxima capacidade para carteira ampla',
    monthlyLabel: 'R$ 657,00',
    yearlyLabel: 'R$ 577,00',
    yearlyTotalLabel: 'R$ 6.924,00 à vista ou parcelado',
    costPerPatientLabel: 'Custo por paciente no plano',
    features: [
      'Atende de 21 a 30 pacientes ativos',
      'Copiloto de IA com integração com paciente',
      'Transcrição de sessões e relatórios compartilhados, com interação do seu copiloto de IA',
      'Inclusão de anexos e prontuários com interatividade da IA',
      'Diário familiar com áudios transcritos para o terapeuta em tempo real',
      'Compra adicional de pacote de pacientes a qualquer momento, com desconto exclusivo',
    ],
    cta: 'Assinar Premium',
  },
];

export const FREE_PLAN = {
  name: 'Plano Degustação / Inicial',
  tagline: 'Para quem quer experimentar a plataforma na prática.',
  features: ['1 paciente ativo', 'Copiloto de IA', 'Diário familiar & Portal'],
  cta: 'Criar conta grátis',
};

export const PLANS_FOOTNOTE =
  'Planos pagos começam com 14 dias grátis · Cancele quando quiser, direto na plataforma · Anual em 12x, com desconto sobre o valor mensal';

export const FAQS = [
  {
    question: 'A IA vai substituir meu julgamento clínico?',
    answer:
      'Não. A Unithery foi desenhada como copiloto: a IA organiza dados, sugere hipóteses e monta rascunhos de relatório — e você debate, questiona e aprova. Toda decisão clínica, assinatura e conduta permanecem 100% do terapeuta.',
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
      'Sim, em duas camadas. Ao criar a conta você entra no Plano Degustação (1 paciente e copiloto de IA) — sem cartão e sem prazo. E ao assinar qualquer plano pago pela primeira vez, você ganha 14 dias grátis: cadastra o cartão, não paga nada no período e pode cancelar a qualquer momento antes da primeira cobrança, direto na plataforma.',
  },
  {
    question: 'Como funciona o plano anual? Posso cancelar?',
    answer:
      'O plano anual dá desconto sobre o valor mensal e é cobrado em 12 parcelas no cartão, com compromisso de 12 meses. Você pode cancelar quando quiser: os meses já utilizados são recalculados ao preço mensal — você só devolve o desconto, sem outras multas. O cancelamento é feito em Perfil e configurações.',
  },
];

export const STATS = [
  { value: '8h+', label: 'economizadas por semana, por terapeuta' },
  { value: '+38%', label: 'de engajamento das famílias' },
  { value: '100%', label: 'do histórico técnico fica com você' },
];

export const FINAL_CTA = {
  eyebrow: 'Pronto para começar?',
  titleLine1: 'Devolva horas à sua semana.',
  titleLine2: 'Comece o teste gratuito hoje.',
  body: 'Crie sua conta no plano gratuito, sem cartão de crédito. Configure seu consultório em minutos e veja o primeiro relatório gerado por IA na próxima sessão.',
  markers: [
    { icon: 'shield' as const, label: 'LGPD-ready' },
    { icon: 'cardSlash' as const, label: 'Plano gratuito sem cartão' },
    { icon: 'clock' as const, label: 'Setup em minutos' },
  ],
};

export const NAV_LINKS = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#funcionalidades', label: 'Funcionalidades' },
  { href: '#planos', label: 'Planos' },
  { href: '#faq', label: 'Dúvidas' },
] as const;

export const HELP_LINK = { to: '/ajuda', label: 'Fale conosco' } as const;

export const LEGAL_ENTITY = {
  legalName: 'SYNES TECH',
  cnpj: '47.465.014/0001-44',
} as const;
