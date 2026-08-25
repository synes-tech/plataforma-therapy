export function formatCheckoutChargeDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function isCheckoutTrialStatus(status: string | null | undefined): boolean {
  return status === 'trial_active' || status === 'trialing';
}

export function checkoutCelebrationCopy(input: {
  planLabel: string;
  isTrial: boolean;
  chargeAtIso: string | null;
  trialDays?: number;
}): { title: string; subtitle: string; planLine: string; warning: string | null } {
  const plan = input.planLabel.trim() || 'seu plano Unithery';
  const chargeDate = formatCheckoutChargeDate(input.chargeAtIso);
  const trialDays = input.trialDays && input.trialDays > 0 ? input.trialDays : 14;

  if (input.isTrial) {
    return {
      title: `Parabéns, você iniciou o período de teste de ${trialDays} dias.`,
      subtitle: 'Aproveite bastante. Agora você faz parte do universo Unithery.',
      planLine: `Seu novo plano é o ${plan}.`,
      warning: chargeDate
        ? `Automaticamente no dia ${chargeDate} será feita a cobrança no cartão cadastrado, caso a assinatura não seja cancelada. Um e-mail de aviso será enviado 24 horas antes do período grátis acabar.`
        : `Ao fim dos ${trialDays} dias a cobrança no cartão acontece automaticamente, a menos que você cancele. Um e-mail de aviso será enviado 24 horas antes do período grátis acabar.`,
    };
  }

  return {
    title: 'Parabéns, agora você faz parte do universo Unithery.',
    subtitle: `Seu novo plano é o ${plan}.`,
    planLine: '',
    warning: null,
  };
}
