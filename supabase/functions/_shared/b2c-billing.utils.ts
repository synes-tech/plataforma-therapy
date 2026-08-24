/**
 * Funções puras do billing B2C — sem Deno, sem Stripe client.
 * Vitest e o webhook compartilham a mesma regra de roteamento (ADR-11).
 */

export const THERY_PLAN_CODE = 'thery_apoio_mensal';
export const THERY_PLAN_NAME = 'Ivy — Acompanhante de Apoio';
export const THERY_LOOKUP_KEY = 'thery_apoio_mensal';
export const THERY_TRIAL_DAYS = 7;
export const THERY_AMOUNT_CENTS = 4990;
export const B2C_CHECKOUT_SOURCE = 'unithery_b2c';
export const B2B_CHECKOUT_SOURCE = 'unithery_billing';

export type StripeAccountType = 'clinic' | 'patient' | 'unknown';

export const PATIENT_ACCESS_STATUSES = new Set(['active', 'trialing', 'past_due']);

export function resolveStripeAccountType(
  metadata?: Record<string, string | undefined> | null,
): StripeAccountType {
  const raw = metadata?.account_type;
  if (raw === 'patient' || raw === 'clinic') return raw;
  if (metadata?.source === B2C_CHECKOUT_SOURCE || Boolean(metadata?.patient_id)) return 'patient';
  if (metadata?.source === B2B_CHECKOUT_SOURCE || Boolean(metadata?.clinic_id)) return 'clinic';
  return 'unknown';
}

export function mapPatientStripeStatus(status: string): string {
  const allowed = new Set([
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused',
  ]);
  return allowed.has(status) ? status : 'incomplete';
}

export function isPatientAccessStatus(status: string): boolean {
  return PATIENT_ACCESS_STATUSES.has(status);
}

export function unixToIso(value: number | null | undefined): string | null {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

export function invoiceSubscriptionIdFromPayload(invoice: {
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
}): string | null {
  const legacy = invoice.subscription;
  if (typeof legacy === 'string') return legacy;
  if (legacy && typeof legacy === 'object') return legacy.id;

  const nested = invoice.parent?.subscription_details?.subscription;
  if (typeof nested === 'string') return nested;
  if (nested && typeof nested === 'object') return nested.id;

  return null;
}

export function trialDaysRemaining(trialEnd: string | null | undefined, now = new Date()): number {
  if (!trialEnd) return 0;
  const end = new Date(trialEnd).getTime();
  if (Number.isNaN(end)) return 0;
  const ms = end - now.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function formatBrlCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatBrDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
}
