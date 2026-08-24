import type Stripe from 'npm:stripe@17.7.0';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getStripeBillingMode } from '../_shared/stripe-billing-config.ts';
import { downgradeClinicToFree } from '../_shared/stripe-billing-provision.ts';
import { sendSesEmail } from '../_shared/aws-ses.ts';
import { isUserBillingExempt } from '../_shared/billing-exempt.ts';
import type { CancelSubscriptionPayload, CancelSubscriptionResponse } from './types.ts';

interface ClinicBillingRow {
  id: string;
  name: string;
  email: string;
  subscription_plan: string;
  subscription_status: string;
  billing_cycle: 'monthly' | 'yearly';
  commitment_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

/**
 * Cancela o plano e revoga o método de pagamento (requisito jurídico crítico).
 *
 * Regras:
 * - Em trial: cancelamento IMEDIATO, sem cobrança, downgrade para FREE na hora.
 * - Mensal ativo: cancela no fim do período pago (acesso mantido até lá).
 * - Anual (12x) dentro do compromisso: aplica quebra de fidelidade — meses usados
 *   recalculados ao preço mensal cheio (perda retroativa dos 12% off), cobrada em
 *   invoice avulsa ANTES de desanexar o cartão. O cancelamento nunca é bloqueado (CDC).
 * - Sempre: desanexa TODOS os payment methods do customer, audita e envia e-mail.
 */
export async function cancelSubscription(
  payload: CancelSubscriptionPayload,
  caller: AuthenticatedUser,
): Promise<CancelSubscriptionResponse> {
  if (!caller.clinic_id) {
    throw new ForbiddenError('Usuário sem clínica associada');
  }

  const billingExempt = await isUserBillingExempt(caller);

  const supabase = createServiceClient();
  const { data: clinic, error } = await supabase
    .from('clinics')
    .select(
      'id, name, email, subscription_plan, subscription_status, billing_cycle, commitment_ends_at, stripe_customer_id, stripe_subscription_id',
    )
    .eq('id', caller.clinic_id)
    .is('deleted_at', null)
    .single();

  if (error || !clinic) {
    throw new AppError({ code: 'CLINIC_NOT_FOUND', message: 'Clínica não encontrada', statusCode: 404 });
  }

  const row = clinic as unknown as ClinicBillingRow;

  const hasStripeSubscription = Boolean(row.stripe_subscription_id);

  if (row.subscription_plan === 'free' && !hasStripeSubscription && !billingExempt) {
    throw new AppError({
      code: 'NOTHING_TO_CANCEL',
      message: 'Sua conta já está no plano Free, sem assinatura ativa.',
      statusCode: 409,
    });
  }

  const { data: plano } = await supabase
    .from('planos')
    .select('nome, preco_mensal_cents, preco_anual_mensal_cents')
    .eq('id', row.subscription_plan)
    .maybeSingle();

  if (billingExempt && !hasStripeSubscription) {
    const nowIso = new Date().toISOString();
    if (payload.action === 'preview') {
      return {
        action: 'preview',
        plan_id: row.subscription_plan,
        plan_name: (plano?.nome as string) ?? row.subscription_plan,
        subscription_status: row.subscription_status,
        billing_cycle: row.billing_cycle,
        in_trial: false,
        effective_at: nowIso,
        cancels_immediately: true,
        yearly_commitment_active: false,
        commitment_ends_at: row.commitment_ends_at,
        fidelity_adjustment_cents: 0,
        fidelity_months_used: 0,
        requires_fidelity_acceptance: false,
        billing_exempt: true,
        has_stripe_subscription: false,
      };
    }
    return {
      action: 'confirm',
      canceled: true,
      cancels_immediately: true,
      effective_at: nowIso,
      downgraded_to_free: false,
      payment_methods_detached: 0,
      fidelity_adjustment_cents: 0,
      fidelity_invoice_id: null,
      fidelity_invoice_paid: false,
      message:
        'Conta administrativa: não há assinatura cobrável nem cartão para remover. O acesso de cortesia continua.',
    };
  }

  const mode = getStripeBillingMode();
  const stripe = getStripeClient(mode);

  let subscription: Stripe.Subscription | null = null;
  if (row.stripe_subscription_id) {
    try {
      subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    } catch {
      subscription = null;
    }
  }

  const inTrial =
    subscription?.status === 'trialing' || row.subscription_status === 'trial_active';

  const now = Date.now();
  const commitmentEnd = row.commitment_ends_at ? new Date(row.commitment_ends_at) : null;
  const yearlyCommitmentActive =
    !billingExempt &&
    row.billing_cycle === 'yearly' &&
    !inTrial &&
    commitmentEnd !== null &&
    commitmentEnd.getTime() > now;

  // Quebra de fidelidade: meses usados × diferença entre preço cheio e preço com 12% off
  let fidelityMonths = 0;
  let fidelityCents = 0;
  if (yearlyCommitmentActive && plano?.preco_anual_mensal_cents) {
    const commitmentStart = new Date(commitmentEnd!);
    commitmentStart.setUTCFullYear(commitmentStart.getUTCFullYear() - 1);
    const elapsedMs = now - commitmentStart.getTime();
    fidelityMonths = Math.min(12, Math.max(1, Math.ceil(elapsedMs / (30.44 * 24 * 60 * 60 * 1000))));
    const diff = Number(plano.preco_mensal_cents) - Number(plano.preco_anual_mensal_cents);
    fidelityCents = Math.max(0, diff * fidelityMonths);
  }

  const cancelsImmediately = inTrial || !subscription;
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : new Date();
  const effectiveAt = cancelsImmediately ? new Date() : periodEnd;

  if (payload.action === 'preview') {
    return {
      action: 'preview',
      plan_id: row.subscription_plan,
      plan_name: (plano?.nome as string) ?? row.subscription_plan,
      subscription_status: row.subscription_status,
      billing_cycle: row.billing_cycle,
      in_trial: inTrial,
      effective_at: effectiveAt.toISOString(),
      cancels_immediately: cancelsImmediately,
      yearly_commitment_active: yearlyCommitmentActive,
      commitment_ends_at: row.commitment_ends_at,
      fidelity_adjustment_cents: fidelityCents,
      fidelity_months_used: fidelityMonths,
      requires_fidelity_acceptance: fidelityCents > 0,
      billing_exempt: billingExempt,
      has_stripe_subscription: hasStripeSubscription,
    };
  }

  // ---------- CONFIRM ----------

  if (fidelityCents > 0 && !payload.accept_fidelity_adjustment) {
    throw new AppError({
      code: 'FIDELITY_ACCEPTANCE_REQUIRED',
      message:
        'O cancelamento antecipado do plano anual exige aceite do acerto de fidelidade (perda retroativa do desconto).',
      statusCode: 400,
      details: { fidelity_adjustment_cents: fidelityCents, months_used: fidelityMonths },
    });
  }

  // 1) Cobrança da quebra de fidelidade (antes de desanexar o cartão).
  //    Falha na cobrança NÃO bloqueia o cancelamento (CDC) — invoice fica em aberto.
  let fidelityInvoiceId: string | null = null;
  let fidelityInvoicePaid = false;
  if (fidelityCents > 0 && row.stripe_customer_id) {
    try {
      // Item vinculado explicitamente à invoice (comportamento estável entre versões da API)
      const invoice = await stripe.invoices.create({
        customer: row.stripe_customer_id,
        collection_method: 'charge_automatically',
        auto_advance: false,
        description: 'Acerto de fidelidade Unithery — cancelamento antecipado do plano anual',
      });
      await stripe.invoiceItems.create({
        customer: row.stripe_customer_id,
        invoice: invoice.id,
        amount: fidelityCents,
        currency: 'brl',
        description: `Acerto de fidelidade — cancelamento antecipado do plano anual (${fidelityMonths} meses recalculados ao preço mensal cheio)`,
      });
      const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
      fidelityInvoiceId = finalized.id;
      if (finalized.status === 'paid') {
        fidelityInvoicePaid = true;
      } else {
        try {
          const paid = await stripe.invoices.pay(finalized.id);
          fidelityInvoicePaid = paid.status === 'paid';
        } catch (payErr) {
          console.error('[cancel-subscription] cobrança da fidelidade falhou (invoice em aberto)', payErr);
        }
      }
    } catch (invErr) {
      console.error('[cancel-subscription] falha ao criar invoice de fidelidade', invErr);
    }
  }

  // 2) Cancelamento da assinatura na Stripe.
  if (subscription) {
    if (cancelsImmediately) {
      await stripe.subscriptions.cancel(subscription.id, {
        invoice_now: false,
        prorate: false,
      });
    } else {
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
        metadata: { ...subscription.metadata, canceled_by: caller.id, canceled_via: 'platform' },
      });
    }
  }

  // 3) Revogação do método de pagamento: desanexa TODOS os cartões do customer.
  let detached = 0;
  if (row.stripe_customer_id) {
    try {
      const methods = await stripe.paymentMethods.list({
        customer: row.stripe_customer_id,
        limit: 100,
      });
      for (const method of methods.data) {
        await stripe.paymentMethods.detach(method.id);
        detached += 1;
      }
      await stripe.customers.update(row.stripe_customer_id, {
        invoice_settings: { default_payment_method: '' },
      });
    } catch (pmErr) {
      console.error('[cancel-subscription] falha ao desanexar payment methods', pmErr);
      throw new AppError({
        code: 'PAYMENT_METHOD_DETACH_FAILED',
        message:
          'A assinatura foi cancelada, mas houve falha ao revogar o cartão. Nossa equipe foi notificada — nenhuma cobrança futura ocorrerá.',
        statusCode: 500,
      });
    }
  }

  // 4) Estado no banco.
  if (cancelsImmediately) {
    await downgradeClinicToFree(row.id, 'cancel-subscription:immediate');
  } else {
    await supabase
      .from('clinics')
      .update({ payment_method_on_file: false })
      .eq('id', row.id);
    await supabase.from('clinic_subscriptions').insert({
      clinic_id: row.id,
      plan: row.subscription_plan,
      status: row.subscription_status,
      canceled_at: new Date().toISOString(),
      ends_at: effectiveAt.toISOString(),
      metadata: {
        stripe: true,
        source: 'cancel-subscription:at_period_end',
        cancel_at_period_end: true,
        fidelity_adjustment_cents: fidelityCents,
        fidelity_invoice_id: fidelityInvoiceId,
      },
    });
  }

  // 5) Auditoria (trilha jurídica).
  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: row.id,
    action: 'billing.subscription.cancel',
    resource_type: 'clinic',
    resource_id: row.id,
    metadata: {
      plan_id: row.subscription_plan,
      billing_cycle: row.billing_cycle,
      in_trial: inTrial,
      cancels_immediately: cancelsImmediately,
      effective_at: effectiveAt.toISOString(),
      payment_methods_detached: detached,
      fidelity_adjustment_cents: fidelityCents,
      fidelity_invoice_id: fidelityInvoiceId,
      fidelity_invoice_paid: fidelityInvoicePaid,
      stripe_subscription_id: row.stripe_subscription_id,
    },
  });

  // 6) E-mail de confirmação (best effort).
  const effectiveBr = effectiveAt.toLocaleDateString('pt-BR');
  try {
    await sendSesEmail({
      to: row.email,
      subject: 'Cancelamento confirmado — Unithery',
      html: `<p>Olá, ${row.name}!</p>
<p>Seu plano foi cancelado e o método de pagamento foi removido da sua conta. ${
        cancelsImmediately
          ? 'O cancelamento é imediato e nenhuma cobrança será feita.'
          : `Você mantém o acesso ao plano até <strong>${effectiveBr}</strong> (período já pago). Após essa data, sua conta passa para o plano Free, sem novas cobranças.`
      }</p>
${
  fidelityCents > 0
    ? `<p>Acerto de fidelidade do plano anual: ${(fidelityCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${fidelityMonths} meses recalculados ao preço mensal cheio).</p>`
    : ''
}
<p>Seus dados clínicos permanecem preservados. Se mudar de ideia, é só assinar novamente.</p>
<p>Equipe Unithery</p>`,
      text: `Seu plano foi cancelado e o método de pagamento foi removido. ${
        cancelsImmediately
          ? 'Cancelamento imediato, nenhuma cobrança será feita.'
          : `Acesso mantido até ${effectiveBr}; depois sua conta passa para o plano Free.`
      }`,
    });
  } catch (mailErr) {
    console.error('[cancel-subscription] falha ao enviar e-mail de confirmação', mailErr);
  }

  return {
    action: 'confirm',
    canceled: true,
    cancels_immediately: cancelsImmediately,
    effective_at: effectiveAt.toISOString(),
    downgraded_to_free: cancelsImmediately,
    payment_methods_detached: detached,
    fidelity_adjustment_cents: fidelityCents,
    fidelity_invoice_id: fidelityInvoiceId,
    fidelity_invoice_paid: fidelityInvoicePaid,
    message: cancelsImmediately
      ? 'Plano cancelado imediatamente. Método de pagamento removido — nenhuma cobrança será feita.'
      : `Plano cancelado. Acesso mantido até ${effectiveBr}; método de pagamento removido — nenhuma nova cobrança ocorrerá.`,
  };
}
