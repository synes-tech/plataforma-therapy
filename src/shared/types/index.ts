// ============================================================
// Unithery — Shared Type Definitions
// ============================================================

export type UserRole = 'master' | 'clinic_admin' | 'professional' | 'family';
export type SubscriptionPlan = 'starter' | 'professional' | 'enterprise';
export type EntityStatus = 'active' | 'inactive' | 'suspended';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  clinic_id: string | null;
  is_solo: boolean;
}

export interface Clinic {
  id: string;
  name: string;
  document: string | null;
  email: string;
  phone: string | null;
  status: EntityStatus;
  subscription_plan: SubscriptionPlan;
  created_at: string;
  updated_at: string;
}

export interface ClinicSettings {
  id: string;
  clinic_id: string;
  max_professionals: number;
  max_patients_per_professional: number;
  max_family_members_per_patient: number;
  max_ai_queries_per_month: number;
  max_audio_minutes_per_month: number;
}

export interface Professional {
  id: string;
  user_id: string;
  clinic_id: string;
  name: string;
  email: string;
  specialty: string | null;
  crp: string | null;
  status: EntityStatus;
  max_patients_override: number | null;
  created_at: string;
  updated_at: string;
}

// API response contract (mirrors backend)
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    request_id: string;
    timestamp: string;
  };
}
