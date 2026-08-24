/**
 * Roteamento polimórfico do webhook Stripe (ADR-11) e caminho dourado B2C.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  invoiceSubscriptionIdFromPayload,
  isPatientAccessStatus,
  mapPatientStripeStatus,
  resolveStripeAccountType,
  trialDaysRemaining,
} from '../../../supabase/functions/_shared/b2c-billing.utils.ts';
import { scanRiskLexicon } from '../../../supabase/functions/_shared/companion/risk-lexicon.ts';
import { mergeRiskLayers } from '../../../supabase/functions/_shared/companion/risk-merge.ts';
import { EMERGENCY_PROTOCOL_TEXT } from '../../../supabase/functions/_shared/companion/emergency-protocol.ts';
import { alertCopy, alertDedupeKey } from '../../../supabase/functions/_shared/companion/alerts.ts';
import { chipsForContext } from './portal-diary';
import { resolveInviteRouting } from '../../../supabase/functions/_shared/patient-profile.ts';

describe('ADR-11 — roteamento do webhook', () => {
  it('paciente: metadata.account_type manda', () => {
    expect(resolveStripeAccountType({
      account_type: 'patient',
      patient_id: 'p1',
    })).toBe('patient');
  });

  it('clínica: account_type clinic mesmo com clinic_id', () => {
    expect(resolveStripeAccountType({
      account_type: 'clinic',
      clinic_id: 'c1',
      source: 'unithery_billing',
    })).toBe('clinic');
  });

  it('sessão B2C sem account_type ainda roteia pelo source/patient_id', () => {
    expect(resolveStripeAccountType({
      source: 'unithery_b2c',
      patient_id: 'p1',
    })).toBe('patient');
  });

  it('sessão B2B legado (sem account_type) continua clínica', () => {
    expect(resolveStripeAccountType({
      source: 'unithery_billing',
      clinic_id: 'c1',
      plan_id: 'standard',
    })).toBe('clinic');
  });

  it('trialing e past_due liberam o chat', () => {
    expect(isPatientAccessStatus('trialing')).toBe(true);
    expect(isPatientAccessStatus('past_due')).toBe(true);
    expect(isPatientAccessStatus('canceled')).toBe(false);
    expect(mapPatientStripeStatus('trialing')).toBe('trialing');
    expect(mapPatientStripeStatus('weird')).toBe('incomplete');
  });

  it('lê o subscription id da invoice nova e da antiga', () => {
    expect(invoiceSubscriptionIdFromPayload({ subscription: 'sub_1' })).toBe('sub_1');
    expect(invoiceSubscriptionIdFromPayload({
      parent: { subscription_details: { subscription: { id: 'sub_2' } } },
    })).toBe('sub_2');
  });

  it('trial de 7 dias: um dia antes ainda conta 1', () => {
    const now = new Date('2026-08-28T15:00:00.000Z');
    expect(trialDaysRemaining('2026-08-29T15:00:00.000Z', now)).toBe(1);
  });
});

describe('Caminho dourado — isolamento, risco e onboarding', () => {
  it('Cenário 2: a frase de crise vira SEVERE, alerta canônico e CVV 188', () => {
    const phrase = 'Não aguento mais, quero sumir do mapa, vou acabar com tudo.';
    const lexicon = scanRiskLexicon(phrase);
    expect(lexicon.level).toBe('SEVERE');

    const merged = mergeRiskLayers(lexicon, {
      risk_level: 'LOW',
      rationale: 'modelo minimizou',
      signals: [],
    });
    expect(merged.risk_level).toBe('SEVERE');
    expect(merged.emergency).toBe(true);
    expect(EMERGENCY_PROTOCOL_TEXT).toContain('188');
    expect(EMERGENCY_PROTOCOL_TEXT).toContain('CVV');

    const copy = alertCopy('SEVERE');
    expect(copy.summary).not.toMatch(/sumir do mapa|acabar com tudo/i);
    expect(copy.title).toMatch(/Risco de vida/);
    expect(alertDedupeKey('patient-a', 'SEVERE', '2026-08-22')).toBe('b2c-severe:patient-a:2026-08-22');
  });

  it('Cenário 3: adulto SELF recebe convite no e-mail próprio e o diário é de humor, não agitação', () => {
    const routing = resolveInviteRouting({
      profileType: 'ADULT',
      emailPaciente: 'ana@exemplo.com',
      emailResponsavel: 'mae@exemplo.com',
      nomePaciente: 'Ana',
      nomeResponsavel: 'Mãe da Ana',
    });
    expect(routing.accessLevel).toBe('SELF');
    expect(routing.email).toBe('ana@exemplo.com');

    const chips = chipsForContext('SELF', 'ADULT').map((chip) => chip.id);
    expect(chips).not.toContain('hiperatividade');
    expect(chips).toContain('trabalho');
  });
});
