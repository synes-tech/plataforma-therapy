/**
 * Contrato de Adesão e Termo de Uso Integrado — conteúdo canônico.
 * Renderizado pelo TermsOfUseModal (landing, registro e onde mais for necessário).
 */

export interface TermsClauseItem {
  /** Lead em destaque (ex.: "Segurança Lógica") */
  lead?: string;
  text: string;
}

export interface TermsClause {
  id: string;
  title: string;
  intro?: string;
  items: TermsClauseItem[];
}

export interface TermsPart {
  id: string;
  label: string;
  title: string;
  clauses: TermsClause[];
}

export const TERMS_TITLE = 'Contrato de Adesão e Termo de Uso Integrado';

export const TERMS_PARTIES =
  'Partes compreendidas: Provedora do Sistema (Unithery), Contratante Principal (Terapeuta/Clínica) e Usuários Vinculados (Pacientes/Familiares).';

export const TERMS_ACCEPTANCE_NOTICE =
  'Aceite eletrônico indispensável: a utilização do software Unithery, tanto no painel administrativo web quanto no aplicativo mobile, importa na adesão automática, irrevogável e plena a este instrumento. O formato dispensa assinatura física e passa a vincular as partes civilmente a partir da validação digital do cadastro ou do primeiro login.';

export const TERMS_PARTS: TermsPart[] = [
  {
    id: 'parte-1',
    label: 'Parte I',
    title: 'Termo de Adesão e Blindagem da Plataforma',
    clauses: [
      {
        id: 'clausula-1',
        title: 'Cláusula 1ª — Do Objeto e Escopo',
        items: [
          {
            text: 'A plataforma Unithery consiste em um ambiente digital unificado voltado ao suporte da gestão clínica multidisciplinar. Suas funções abrangem prontuário eletrônico do terapeuta, controle de agenda, cruzamento de dados por Inteligência Artificial (Copiloto IA), além de um painel mobile dedicado ao preenchimento de diários de rotina e check-ins comportamentais por parte do núcleo familiar do paciente.',
          },
        ],
      },
      {
        id: 'clausula-2',
        title: 'Cláusula 2ª — Da Proteção de Dados (LGPD)',
        items: [
          {
            lead: 'Segurança Lógica',
            text: 'A Unithery adota medidas de proteção, criptografia em trânsito e armazenamento seguro compatíveis com as normativas da Lei Geral de Proteção de Dados (LGPD) para dados de saúde (dados sensíveis).',
          },
          {
            lead: 'Posição Jurídica',
            text: 'O sistema atua exclusivamente na condição de Operador de Dados. A guarda jurídica, coleta primária e o dever de obter o consentimento dos representantes legais pertencem unicamente à clínica ou ao profissional que efetua o atendimento clínico.',
          },
        ],
      },
      {
        id: 'clausula-3',
        title: 'Cláusula 3ª — Da Propriedade Exclusiva dos Dados Clínicos',
        items: [
          {
            lead: 'Exclusividade da Informação',
            text: 'Todos os relatos, notas, históricos de check-in, anexos documentais e evoluções clínicas inseridos no ecossistema pertencem de forma restrita e exclusiva ao Terapeuta ou à Clínica Contratante.',
          },
          {
            lead: 'Isenção da Provedora',
            text: 'A Unithery está expressamente proibida de acessar, auditar, transferir ou utilizar os dados clínicos armazenados para qualquer finalidade comercial, publicitária ou de terceiros, operando apenas o processamento automatizado requisitado pelo usuário logado (incluindo o motor do Copiloto IA).',
          },
        ],
      },
      {
        id: 'clausula-4',
        title: 'Cláusula 4ª — Da Total Ausência de Intermédio e Responsabilidade',
        items: [
          {
            lead: 'Inexistência de Vínculo Clínico',
            text: 'A Unithery não possui qualquer ingerência, nexo causal ou responsabilidade técnica por diagnósticos, condutas clínicas, prescrições de atividades ou tratamentos propostos dentro da plataforma. O sistema é uma ferramenta puramente de meio e suporte informático.',
          },
          {
            lead: 'Riscos e Isenções',
            text: 'Sob nenhuma hipótese a Unithery responderá civil ou eticamente por falhas na conduta do profissional de saúde, dados corrompidos por exclusão manual indevida, ou disputas jurídicas travadas entre o terapeuta e os núcleos familiares por ele atendidos.',
          },
        ],
      },
    ],
  },
  {
    id: 'parte-2',
    label: 'Parte II',
    title: 'Termo de Uso da Plataforma (Matriz de Responsabilidades)',
    clauses: [
      {
        id: 'clausula-5',
        title: 'Cláusula 5ª — Das Responsabilidades Específicas do Terapeuta (Painel Web)',
        intro:
          'O Terapeuta ou a Clínica, ao utilizar o painel administrativo e clínico, compromete-se a:',
        items: [
          {
            lead: 'Fidedignidade e Sigilo Técnico',
            text: 'Responder integralmente pela exatidão técnica de todas as anotações feitas em prontuário eletrônico, mantendo o sigilo ético exigido por seu conselho de classe (ex.: CREFITO, CRP, CRM etc.).',
          },
          {
            lead: 'Supervisão Estrita do Copiloto IA',
            text: 'Assumir o dever absoluto de revisar, validar e aprovar toda e qualquer orientação, plano ou relatório de rotina gerado com o auxílio do Copiloto IA. A Inteligência Artificial serve como ferramenta de auxílio de texto e estruturação de ideias, não substituindo o julgamento clínico. Todas as peças finais compartilhadas devem conter as credenciais e o nome do profissional logado como responsável pelo conteúdo.',
          },
          {
            lead: 'Controle de Segurança no Vínculo',
            text: 'Conferir as informações através do mecanismo de validação assíncrona antes de chancelar o vínculo de códigos com o aplicativo mobile, garantindo que os dados não sejam expostos a terceiros por erros de digitação de senhas ou chaves.',
          },
          {
            lead: 'Gestão de Privacidade',
            text: 'Utilizar os componentes internos de controle de visibilidade (toggles/checkboxes de privacidade) para determinar quais observações de IA devem ser enviadas ao painel mobile da família e quais devem permanecer de acesso exclusivo do prontuário interno da clínica.',
          },
          {
            lead: 'Segurança de Arquivos e Anexos',
            text: 'Responsabilizar-se pela procedência legal, livre de vírus e adequada ética profissional de quaisquer arquivos anexados (PDF, Word etc.) no banco de dados do paciente, inclusive ciente de que tais arquivos serão integrados ao mecanismo de leitura do ecossistema de IA.',
          },
        ],
      },
      {
        id: 'clausula-6',
        title: 'Cláusula 6ª — Das Responsabilidades Específicas do Paciente / Família (App Mobile)',
        intro:
          'O Paciente e seus familiares e responsáveis legais vinculados, ao utilizarem o aplicativo móvel, comprometem-se a:',
        items: [
          {
            lead: 'Veracidade dos Registros do Diário',
            text: 'Preencher com dados reais e precisos o Diário de Rotina, ocorrências de comportamento e os múltiplos check-ins permitidos no dia, ciente de que tais dados servem de base para a análise clínica conduzida pelo terapeuta responsável.',
          },
          {
            lead: 'Gerenciamento Autônomo de Calendário e Consultas',
            text: 'Monitorar de forma independente as datas e os horários das Terapias Agendadas exibidos no calendário dedicado, reconhecendo que os lembretes automatizados são ferramentas de cortesia tecnológica e não anulam a obrigação da família de cumprir a agenda acordada com a clínica.',
          },
          {
            lead: 'Uso de Senhas e Guarda de Dispositivos',
            text: 'Manter o acesso ao aplicativo mobile restrito aos responsáveis pela criança ou paciente, não compartilhando senhas de login ou o código de vínculo único gerado pelo terapeuta, a fim de evitar vazamento acidental de informações confidenciais de saúde.',
          },
          {
            lead: 'Entendimento de Limitação Tecnológica',
            text: 'Compreender que as mensagens, orientações visíveis no app e alertas emitidos pela plataforma não constituem atendimento médico de urgência ou emergência. Qualquer intercorrência grave de saúde física ou mental deve ser tratada diretamente nos canais tradicionais de pronto-atendimento ou contato telefônico com o profissional assistente.',
          },
        ],
      },
      {
        id: 'clausula-7',
        title: 'Cláusula 7ª — Das Vedações Gerais de Uso para Ambas as Partes',
        intro: 'É expressamente proibido a qualquer usuário do sistema:',
        items: [
          {
            text: 'Utilizar técnicas de engenharia reversa para tentar acessar o código-fonte da plataforma ou burlar o modelo de linguagem estruturado da IA;',
          },
          {
            text: 'Imputar dados falsos, caluniosos ou que violem os direitos autorais e de privacidade de terceiros;',
          },
          {
            text: 'Burlar os limites operacionais estabelecidos pela Unithery, incluindo o uso de robôs ou scripts automatizados para extração maciça de dados da base do sistema.',
          },
        ],
      },
    ],
  },
];
