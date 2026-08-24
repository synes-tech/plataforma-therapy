import type { TheryPose } from '@shared/lib/thery-assets';

export type TheryTourAudience = 'professional' | 'clinic_admin' | 'patient' | 'caregiver';

export type TheryTourViewport = 'desktop' | 'mobile' | 'both';

export type TheryTourPlacement = 'dock' | 'inline' | 'spotlight';

export type TheryTourRequirement = 'finance' | 'owner' | 'patient';

export type TheryTourStatus = 'skipped' | 'in_progress' | 'completed';

export interface TheryTourStep {
  id: string;
  route: string;
  target?: string;
  fallbackTarget?: string;
  pose: TheryPose;
  placement: TheryTourPlacement;
  title: string;
  body: string;
  ctaLabel?: string;
  viewport: TheryTourViewport;
  requires?: TheryTourRequirement;
  /** Quando o alvo não aparece, o motor pula o passo. Default: true se `target` existir. */
  skipIfMissingTarget?: boolean;
}

export interface TheryTourRecord {
  status: TheryTourStatus;
  stepIndex: number;
  updatedAt: string;
}

export interface TheryTourRuntimeContext {
  audience: TheryTourAudience;
  viewport: 'desktop' | 'mobile';
  canFinance: boolean;
  isOwner: boolean;
  patientId: string | null;
}

export interface TheryTourApi {
  audience: TheryTourAudience | null;
  active: boolean;
  welcomeOpen: boolean;
  step: TheryTourStep | null;
  stepIndex: number;
  stepCount: number;
  firstName: string;
  patientId: string | null;
  start: () => void;
  skipAll: () => void;
  next: () => void;
  back: () => void;
  replay: () => void;
  skipMissing: (stepId: string) => void;
}
