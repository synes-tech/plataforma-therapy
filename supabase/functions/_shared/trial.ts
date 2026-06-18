/** Dias de trial grátis no onboarding (Fase 1 PLG). */
export const TRIAL_DAYS = 14;

export function computeTrialEndsAt(from: Date = new Date()): Date {
  const ends = new Date(from);
  ends.setUTCDate(ends.getUTCDate() + TRIAL_DAYS);
  return ends;
}

export function defaultTrialPlanId(accountType: 'solo' | 'corporate'): 'consultorio' | 'starter' {
  return accountType === 'solo' ? 'consultorio' : 'starter';
}
