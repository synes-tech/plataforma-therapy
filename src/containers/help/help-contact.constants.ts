export const HELP_PATH = '/ajuda';

export const HELP_SUBJECTS = [
  { value: 'duvida_plataforma', label: 'Dúvida sobre a plataforma' },
  { value: 'problema_tecnico', label: 'Problema técnico / erro' },
  { value: 'cobranca', label: 'Cobrança e assinatura' },
  { value: 'cadastro_acesso', label: 'Cadastro e acesso' },
  { value: 'privacidade', label: 'Privacidade e dados (LGPD)' },
  { value: 'comercial', label: 'Parceria / comercial' },
  { value: 'outro', label: 'Outro' },
] as const;

export type HelpSubjectValue = (typeof HELP_SUBJECTS)[number]['value'];
