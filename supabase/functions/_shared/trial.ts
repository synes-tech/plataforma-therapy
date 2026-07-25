/** Dias de trial grátis concedidos no primeiro checkout Stripe (com cartão). */
export const TRIAL_DAYS = 14;

export function computeTrialEndsAt(from: Date = new Date()): Date {
  const ends = new Date(from);
  ends.setUTCDate(ends.getUTCDate() + TRIAL_DAYS);
  return ends;
}

/**
 * Plano de entrada no registro (v2): terapeuta solo entra no FREE
 * (1 paciente, 4 sessões/mês, 20 interações de IA). O trial de 14 dias
 * é concedido apenas no primeiro checkout de um plano pago.
 */
export function defaultTrialPlanId(accountType: 'solo' | 'corporate'): 'free' | 'starter' {
  return accountType === 'solo' ? 'free' : 'starter';
}
