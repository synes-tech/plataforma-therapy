export interface ClinicSettingsFormSource {
  admin_name?: string;
  owner_profile?: {
    kind?: 'professional' | 'clinic_admin';
    name?: string | null;
    email?: string | null;
    specialty?: string | null;
    crp?: string | null;
    foto_url?: string | null;
  };
  clinic?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    document?: string | null;
    is_solo_professional?: boolean;
  };
  preferences?: {
    crisis_alerts_email?: boolean;
    weekly_digest_email?: boolean;
    ai_usage_alerts?: boolean;
  };
  data?: ClinicSettingsFormSource;
}

export interface SettingsFormState {
  profile: { name: string; email: string; phone: string; document: string };
  ownerProfile: {
    name: string;
    email: string;
    specialty: string;
    crp: string;
    foto_url: string | null;
    kind: 'professional' | 'clinic_admin';
  };
  prefs: {
    crisis_alerts_email: boolean;
    weekly_digest_email: boolean;
    ai_usage_alerts: boolean;
  };
}

/** Aceita o payload direto ou envelopado em `{ data }` (resposta dupla). */
export function unwrapClinicSettings(raw: unknown): ClinicSettingsFormSource | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as ClinicSettingsFormSource;
  if (obj.clinic || obj.owner_profile || obj.preferences) return obj;
  if (obj.data && (obj.data.clinic || obj.data.owner_profile || obj.data.preferences)) {
    return obj.data;
  }
  return null;
}

export function clinicSettingsToFormState(raw: unknown): SettingsFormState | null {
  const data = unwrapClinicSettings(raw);
  if (!data) return null;

  const owner = data.owner_profile;
  return {
    profile: {
      name: data.clinic?.name ?? '',
      email: data.clinic?.email ?? '',
      phone: data.clinic?.phone ?? '',
      document: data.clinic?.document ?? '',
    },
    ownerProfile: {
      name: owner?.name ?? data.admin_name ?? '',
      email: owner?.email ?? '',
      specialty: owner?.specialty ?? '',
      crp: owner?.crp ?? '',
      foto_url: owner?.foto_url ?? null,
      kind: owner?.kind === 'clinic_admin' ? 'clinic_admin' : 'professional',
    },
    prefs: {
      crisis_alerts_email: data.preferences?.crisis_alerts_email ?? true,
      weekly_digest_email: data.preferences?.weekly_digest_email ?? true,
      ai_usage_alerts: data.preferences?.ai_usage_alerts ?? true,
    },
  };
}

export function isSettingsFormDirty(
  current: Pick<SettingsFormState, 'profile' | 'ownerProfile' | 'prefs'>,
  baseline: SettingsFormState | null,
): boolean {
  if (!baseline) return false;

  return (
    current.profile.name !== baseline.profile.name ||
    current.profile.email !== baseline.profile.email ||
    current.profile.phone !== baseline.profile.phone ||
    current.profile.document !== baseline.profile.document ||
    current.ownerProfile.name !== baseline.ownerProfile.name ||
    current.ownerProfile.specialty !== baseline.ownerProfile.specialty ||
    current.ownerProfile.crp !== baseline.ownerProfile.crp ||
    current.prefs.crisis_alerts_email !== baseline.prefs.crisis_alerts_email ||
    current.prefs.weekly_digest_email !== baseline.prefs.weekly_digest_email ||
    current.prefs.ai_usage_alerts !== baseline.prefs.ai_usage_alerts
  );
}

export function patientUsagePercent(used: number, limit: number | null): number | null {
  if (limit == null || limit <= 0) return null;
  return Math.min(100, Math.round((Math.max(0, used) / limit) * 100));
}
