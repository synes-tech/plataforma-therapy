/** Janela do aviso de 24h (job horário). */
export const CLINIC_TRIAL_WARNING_MIN_MS = 23 * 60 * 60 * 1000;
export const CLINIC_TRIAL_WARNING_MAX_MS = 25 * 60 * 60 * 1000;

export function clinicTrialIn24hWindow(trialEndsAt: Date, now: Date = new Date()): boolean {
  const delta = trialEndsAt.getTime() - now.getTime();
  return delta >= CLINIC_TRIAL_WARNING_MIN_MS && delta <= CLINIC_TRIAL_WARNING_MAX_MS;
}
