/** Tipo de conta no onboarding — mapeia para planos e fluxo de cadastro */
export type AccountType = 'corporate' | 'solo';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  corporate: 'Sou uma Clínica',
  solo: 'Sou Profissional Autônomo',
};

export const ACCOUNT_TYPE_DESCRIPTIONS: Record<AccountType, string> = {
  corporate: 'Gerencio uma equipe de terapeutas e preciso de visão corporativa dos prontuários.',
  solo: 'Atendo sozinho(a) no meu consultório — sem equipe nem CNPJ obrigatório.',
};

export function isCorporateAccount(type: AccountType): boolean {
  return type === 'corporate';
}
