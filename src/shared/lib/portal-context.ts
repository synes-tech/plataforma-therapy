import { useQuery } from '@tanstack/react-query';
import { callFunction } from './api';
import { useAuth } from '@shared/hooks/useAuth';
import type {
  ClinicalModule,
  PatientProfileType,
  PortalAccessLevel,
} from './clinical-profile';

/**
 * Contexto do Portal Unithery.
 *
 * O mesmo PWA serve duas pessoas: um cuidador acompanhando alguém, e um paciente
 * acompanhando a si mesmo. Tudo o que muda entre as duas experiências — as perguntas do
 * diário, os itens da navegação, o tom dos textos — deriva daqui. Um único ponto de
 * verdade, resolvido no servidor a partir do vínculo, para que o cliente não possa se
 * declarar algo que não é.
 */

export interface PortalSubscription {
  status: string;
  plan_code: string;
  active: boolean;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface PortalContext {
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
    companion_chat: boolean;
    can_subscribe: boolean;
  };
}

export const PORTAL_CONTEXT_QUERY_KEY = ['portal-context'] as const;

export function usePortalContext() {
  const { user } = useAuth();

  return useQuery({
    queryKey: PORTAL_CONTEXT_QUERY_KEY,
    queryFn: () => callFunction<PortalContext>('get-portal-context', {}),
    enabled: Boolean(user) && user?.role === 'family',
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function isSelfMode(context: PortalContext | undefined): boolean {
  return context?.access.level === 'SELF';
}

/**
 * Como o portal se refere ao paciente.
 *
 * Um cuidador precisa do nome ("Como foi o dia de Lucas?"); o próprio paciente não deve ler
 * o próprio nome em terceira pessoa, o que soaria clínico e distante justamente no lugar
 * mais íntimo do produto.
 */
export function subjectLabel(context: PortalContext | undefined): string {
  if (!context) return '';
  return context.access.level === 'SELF' ? 'você' : context.patient.first_name;
}

export function portalTitle(context: PortalContext | undefined): string {
  return isSelfMode(context) ? 'Meu espaço' : 'Portal Unithery';
}
