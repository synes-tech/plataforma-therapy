import { therapistPlanPatientLimit, patientUsagePercent } from '@shared/lib/therapist-plans';
import { fallbackAddonForPlan } from '@containers/billing/billing-patient-pack.utils';
import type { PlanControlState } from '@containers/billing/plan-control.types';

export type PatientQuotaTone = 'ok' | 'warn' | 'full';
export type PatientQuotaSnapshot = NonNullable<PlanControlState['patient_quota']>;

/** Limite de carteira quando o admin não tem `patient_quota` da API (conta isenta). */
const ADMIN_PLAN_LIMIT_FALLBACK: Record<string, number> = {
  free: 1,
  standard: 10,
  advanced: 20,
  premium: 30,
  inicial: 10,
  consultorio: 10,
  intermediario: 40,
  starter: 40,
  professional: 60,
};

export interface ClinicSettingsUsageFallback {
  planId?: string;
  activeCount: number;
  quotaBonus: number;
}

/** Aviso a partir de 80% da cota; cheio em 100%. */
export const PATIENT_QUOTA_WARN_PERCENT = 80;

export function patientQuotaTone(activeCount: number, totalLimit: number): PatientQuotaTone {
  if (totalLimit <= 0) return 'ok';
  if (activeCount >= totalLimit) return 'full';
  if (patientUsagePercent(activeCount, totalLimit) >= PATIENT_QUOTA_WARN_PERCENT) return 'warn';
  return 'ok';
}

export function formatPatientQuotaLabel(activeCount: number, totalLimit: number): string {
  return `${activeCount} / ${totalLimit}`;
}

export function patientQuotaRemaining(activeCount: number, totalLimit: number): number {
  if (totalLimit <= 0) return 0;
  return Math.max(0, totalLimit - activeCount);
}

export function shouldShowPatientQuotaChip(totalLimit: number | null | undefined): boolean {
  return typeof totalLimit === 'number' && totalLimit > 0;
}

export function clinicSettingsUsageFallback(raw: unknown): ClinicSettingsUsageFallback | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const inner = (
    obj.data && typeof obj.data === 'object' ? obj.data : obj
  ) as Record<string, unknown>;
  const clinic = inner.clinic as { subscription_plan?: string } | undefined;
  const usage = inner.resource_usage as
    | {
        active_patients_clinic_total?: number;
        active_patients_owner_count?: number;
        owner_is_professional?: boolean;
        patient_quota_bonus?: number;
      }
    | undefined;
  if (!usage) return null;
  const activeCount = usage.owner_is_professional
    ? Number(usage.active_patients_owner_count ?? 0)
    : Number(usage.active_patients_clinic_total ?? 0);
  return {
    planId: clinic?.subscription_plan,
    activeCount,
    quotaBonus: Number(usage.patient_quota_bonus ?? 0),
  };
}

function planBaseLimitForAdmin(planId: string): number {
  const fromCatalog = therapistPlanPatientLimit(planId);
  if (fromCatalog && fromCatalog > 0) return fromCatalog;
  return ADMIN_PLAN_LIMIT_FALLBACK[planId] ?? 30;
}

/** Admin (e master) vê a cota mesmo quando a API omite o payload ou zera o limite (conta isenta). */
export function resolvePatientQuotaForViewer(input: {
  isAdminViewer: boolean;
  planId?: string;
  quota: PatientQuotaSnapshot | null;
  settingsFallback?: ClinicSettingsUsageFallback | null;
}): PatientQuotaSnapshot | null {
  const { quota, isAdminViewer, settingsFallback } = input;
  if (quota && quota.total_limit > 0) return quota;
  if (!isAdminViewer) return null;

  const planId = input.planId || settingsFallback?.planId || '';
  if (!planId) return null;
  const planBase =
    quota?.plan_base_limit && quota.plan_base_limit > 0
      ? quota.plan_base_limit
      : planBaseLimitForAdmin(planId);
  const bonus = quota?.quota_bonus ?? settingsFallback?.quotaBonus ?? 0;
  const active = quota?.active_count ?? settingsFallback?.activeCount ?? 0;

  return {
    plan_base_limit: planBase,
    quota_bonus: bonus,
    total_limit: planBase + bonus,
    active_count: active,
    addon: quota?.addon ?? fallbackAddonForPlan(planId),
  };
}

export function patientQuotaModalHint(tone: PatientQuotaTone, canBuyAddon: boolean): string {
  if (tone === 'full') {
    return canBuyAddon
      ? 'Você atingiu o limite do plano. Mude de plano ou contrate um módulo de +5 pacientes para continuar cadastrando.'
      : 'Você atingiu o limite do plano. Mude de plano para cadastrar mais pacientes.';
  }
  if (tone === 'warn') {
    return canBuyAddon
      ? 'Sua carteira está perto do limite. Você pode subir de plano ou incluir +5 pacientes agora.'
      : 'Sua carteira está perto do limite. Suba de plano para cadastrar mais pacientes.';
  }
  return canBuyAddon
    ? 'Precisa de mais vagas? Mude de plano ou contrate um módulo extra de +5 pacientes, sem esperar esgotar a cota.'
    : 'Precisa de mais vagas? Compare os planos e altere sua assinatura.';
}
