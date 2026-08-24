import type { PortalContext, PortalSubscription } from '@shared/lib/portal-context';

export const THERY_PLAN_NAME = 'Ivy — Acompanhante de Apoio';
export const THERY_AMOUNT_CENTS = 4990;
export const THERY_TRIAL_DAYS = 7;

export function formatBrlCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatBrDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
}

export function trialDaysRemaining(trialEnd: string | null | undefined, now = new Date()): number {
  if (!trialEnd) return 0;
  const end = new Date(trialEnd).getTime();
  if (Number.isNaN(end)) return 0;
  const ms = end - now.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function showTherySubscriptionPanel(context: PortalContext | undefined): boolean {
  if (!context) return false;
  return context.access.level === 'SELF' && (context.capabilities.can_subscribe || Boolean(context.subscription));
}

export function subscriptionPanelCopy(
  subscription: PortalSubscription | null,
  canSubscribe: boolean,
  now = new Date(),
): {
  title: string;
  body: string;
  cta: 'subscribe' | 'cancel' | 'none';
  trialDays: number;
} {
  if (canSubscribe || !subscription) {
    return {
      title: THERY_PLAN_NAME,
      body:
        `7 dias grátis com cartão. Depois, ${formatBrlCents(THERY_AMOUNT_CENTS)} por mês. ` +
        'A Ivy é uma Acompanhante de Apoio — não substitui o seu psicólogo. ' +
        'Cancele quando quiser, antes da cobrança.',
      cta: 'subscribe',
      trialDays: THERY_TRIAL_DAYS,
    };
  }

  if (subscription.status === 'trialing') {
    const days = trialDaysRemaining(subscription.trial_end, now);
    const when = formatBrDate(subscription.trial_end);
    return {
      title: 'Período gratuito da Ivy',
      body: subscription.cancel_at_period_end
        ? `O acesso segue até ${when || 'o fim do período'}. Nenhuma cobrança será feita.`
        : `Faltam ${days} dia${days === 1 ? '' : 's'} do trial. Em ${when || 'breve'} cobramos ${formatBrlCents(THERY_AMOUNT_CENTS)} no cartão cadastrado, se você não cancelar.`,
      cta: subscription.cancel_at_period_end ? 'none' : 'cancel',
      trialDays: days,
    };
  }

  if (subscription.active) {
    const until = formatBrDate(subscription.current_period_end);
    return {
      title: 'Ivy ativa',
      body: subscription.cancel_at_period_end
        ? `Cancelamento agendado. Você mantém o Acompanhante até ${until || 'o fim do período pago'}.`
        : `Assinatura de ${formatBrlCents(THERY_AMOUNT_CENTS)}/mês. Próxima renovação em ${until || 'breve'}.`,
      cta: subscription.cancel_at_period_end ? 'none' : 'cancel',
      trialDays: 0,
    };
  }

  return {
    title: THERY_PLAN_NAME,
    body: 'Sua assinatura não está ativa. Você pode assinar de novo quando quiser.',
    cta: 'subscribe',
    trialDays: 0,
  };
}
