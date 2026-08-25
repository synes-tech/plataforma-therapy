/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  billingPlanLabel,
  buildBillingPlanChangedEmail,
  buildBillingTrialEnding24hEmail,
  buildBillingWelcomeEmail,
} from '../../../supabase/functions/_shared/billing-email-templates.ts';
import {
  appendProfessionalRecipient,
  resolveSessionEmailRecipients,
} from '../../../supabase/functions/_shared/session-email-recipients.ts';
import { buildSessionEmailContent } from '../../../supabase/functions/_shared/session-email-templates.ts';

describe('billing-email-templates', () => {
  it('monta boas-vindas com o nome do plano', () => {
    const mail = buildBillingWelcomeEmail({
      ownerName: 'Joao Paulo',
      clinicName: 'Consultório Joao Paulo',
      planId: 'standard',
      billingCycle: 'monthly',
    });
    expect(mail.subject).toContain('Parabéns, Joao Paulo');
    expect(mail.subject).toContain('time Unithery');
    expect(mail.html).toContain('Bem-vindo ao time Unithery');
    expect(mail.html).toContain('Plano Standard');
    expect(mail.text).toContain('faz parte do time Unithery');
  });

  it('monta e-mail de alteração de plano', () => {
    const mail = buildBillingPlanChangedEmail({
      ownerName: 'Ana',
      clinicName: 'Clínica Ana',
      previousPlanId: 'standard',
      nextPlanId: 'premium',
      billingCycle: 'yearly',
    });
    expect(mail.subject).toContain('Plano Premium');
    expect(mail.html).toContain('Plano Standard');
    expect(mail.html).toContain('Plano Premium');
    expect(billingPlanLabel('advanced')).toBe('Plano Advanced');
  });

  it('monta o aviso de 24h com o caminho de cancelamento', () => {
    const mail = buildBillingTrialEnding24hEmail({
      ownerName: 'Joao',
      clinicName: 'Consultório Joao',
      planId: 'premium',
      trialEndsAt: '2026-09-07T19:00:00.000Z',
      settingsUrl: 'https://unithery.com/settings',
    });
    expect(mail.subject).toContain('24 horas');
    expect(mail.html).toContain('Plano Premium');
    expect(mail.html).toContain('Cancelar plano e revogar método de pagamento');
    expect(mail.html).toContain('https://unithery.com/settings');
    expect(mail.text).toContain('não precisa fazer nada');
  });
});

describe('session email — cópia do profissional', () => {
  it('acrescenta o psicólogo sem duplicar e-mail', () => {
    const contacts = resolveSessionEmailRecipients({
      id: 'p1',
      name: 'Maria',
      contact_scope: 'responsible',
      email_responsavel: 'mae@teste.com',
      nome_responsavel: 'Mãe',
    });
    const withPro = appendProfessionalRecipient(contacts, {
      email: 'psico@teste.com',
      name: 'Dra. Ana',
    });
    expect(withPro.map((r) => r.role)).toEqual(['responsible', 'professional']);

    const sameEmail = appendProfessionalRecipient(contacts, {
      email: 'mae@teste.com',
      name: 'Dra. Ana',
    });
    expect(sameEmail).toHaveLength(1);
  });

  it('usa texto de cópia quando o destinatário é o profissional', () => {
    const mail = buildSessionEmailContent({
      kind: 'booking_confirmation',
      contactName: 'Dra. Ana',
      patientName: 'Maria',
      professionalName: 'Dra. Ana',
      sessionAtIso: '2026-08-20T15:00:00-03:00',
      durationMinutes: 50,
      audience: 'professional',
    });
    expect(mail.html).toContain('cópia da confirmação');
    expect(mail.html).toContain('Maria');
  });

  it('monta aviso de cancelamento para a família e para o psicólogo', () => {
    const family = buildSessionEmailContent({
      kind: 'cancel_notice',
      contactName: 'Mãe',
      patientName: 'Maria',
      professionalName: 'Dra. Ana',
      sessionAtIso: '2026-08-20T15:00:00-03:00',
      durationMinutes: 50,
      audience: 'contact',
    });
    expect(family.subject).toContain('Atendimento cancelado');
    expect(family.html).toContain('foi cancelado');
    expect(family.html).toContain('Dra. Ana');
    expect(family.text).toContain('Data e horário cancelados');

    const pro = buildSessionEmailContent({
      kind: 'cancel_notice',
      contactName: 'Dra. Ana',
      patientName: 'Maria',
      professionalName: 'Dra. Ana',
      sessionAtIso: '2026-08-20T15:00:00-03:00',
      durationMinutes: 50,
      audience: 'professional',
    });
    expect(pro.html).toContain('A família também recebeu este aviso');
    expect(pro.text).toContain('A família também foi avisada');
  });
});
