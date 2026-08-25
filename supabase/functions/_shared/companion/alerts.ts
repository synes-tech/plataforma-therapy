import type { ClinicalRiskLevel } from '../patient-profile.ts';

export const SEVERE_ALERT_TITLE = 'Risco de vida sinalizado no Acompanhante';
export const SEVERE_ALERT_SUMMARY =
  'O paciente sinalizou risco de vida no chat da Ivy. O protocolo de emergência (CVV 188, SAMU 192) foi exibido. Entre em contato o quanto antes.';

export const MODERATE_ALERT_TITLE = 'Sofrimento intenso no Acompanhante';
export const MODERATE_ALERT_SUMMARY =
  'O paciente relatou sofrimento intenso no chat da Ivy. Não há sinal de risco de vida neste alerta. Vale olhar com mais cuidado no próximo encontro.';

const BR_TZ = 'America/Sao_Paulo';

export function brDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function brWeekday(date = new Date()): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: BR_TZ, weekday: 'short' }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd.slice(0, 3)] ?? 0;
}

export function brHour(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: BR_TZ,
      hour: 'numeric',
      hour12: false,
    }).format(date),
  );
}

/** R4: MODERATE não empurra notificação fora do horário clínico. SEVERE sempre empurra. */
export function shouldNotifyNow(severity: ClinicalRiskLevel, at = new Date()): boolean {
  if (severity === 'SEVERE') return true;
  if (severity !== 'MODERATE') return false;
  const weekday = brWeekday(at);
  if (weekday === 0 || weekday === 6) return false;
  const hour = brHour(at);
  return hour >= 8 && hour < 20;
}

export type CrisisEmailKind = 'companion_severe' | 'companion_moderate' | 'checkin_crisis';

/**
 * SEVERE da Ivy sempre e-mail (dever de cuidado).
 * Check-in de crise e MODERATE respeitam a preferência da clínica;
 * MODERATE ainda fica no horário clínico.
 */
export function shouldEmailCrisisAlert(input: {
  kind: CrisisEmailKind;
  clinicAllowsEmail: boolean;
  at?: Date;
}): boolean {
  if (input.kind === 'companion_severe') return true;
  if (!input.clinicAllowsEmail) return false;
  if (input.kind === 'companion_moderate') return shouldNotifyNow('MODERATE', input.at);
  return true;
}

export function alertCopy(severity: 'MODERATE' | 'SEVERE'): { title: string; summary: string } {
  if (severity === 'SEVERE') {
    return { title: SEVERE_ALERT_TITLE, summary: SEVERE_ALERT_SUMMARY };
  }
  return { title: MODERATE_ALERT_TITLE, summary: MODERATE_ALERT_SUMMARY };
}

export function alertDedupeKey(patientId: string, severity: 'MODERATE' | 'SEVERE', day = brDateKey()): string {
  return `b2c-${severity.toLowerCase()}:${patientId}:${day}`;
}

export function compareClinicalAlerts<T extends { severity: string; occurred_at: string }>(a: T, b: T): number {
  const rank = (value: string) => (value === 'SEVERE' ? 2 : value === 'MODERATE' ? 1 : 0);
  const bySeverity = rank(b.severity) - rank(a.severity);
  if (bySeverity !== 0) return bySeverity;
  return new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
}
