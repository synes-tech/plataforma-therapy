import type { ClinicalModule, PatientProfileType, PortalAccessLevel } from '../_shared/patient-profile.ts';

export interface PortalSubscription {
  status: string;
  plan_code: string;
  /** Vale o acesso premium agora — inclui trial. */
  active: boolean;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface GetPortalContextResponse {
  patient: {
    id: string;
    name: string;
    first_name: string;
    profile_type: PatientProfileType;
    active_modules: ClinicalModule[];
    birth_date: string | null;
  };
  access: {
    level: PortalAccessLevel;
    link_id: string;
    relationship: string;
    is_primary_contact: boolean;
  };
  subscription: PortalSubscription | null;
  capabilities: {
    /** Chat do Acompanhante: só o próprio paciente, adulto e assinante ativo. */
    companion_chat: boolean;
    /** Pode assinar: adulto com acesso próprio e sem assinatura ativa. */
    can_subscribe: boolean;
  };
}
