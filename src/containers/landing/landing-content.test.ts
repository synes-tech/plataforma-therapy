import { describe, expect, it } from 'vitest';
import {
  FAQS,
  FEATURES,
  FINAL_CTA,
  FREE_PLAN,
  HELP_LINK,
  HERO,
  LEGAL_ENTITY,
  NAV_LINKS,
  PAID_PLANS,
  PILLARS,
  SOCIAL_PROOF,
  STEPS,
  WHY_ITEMS,
} from './landing-content';

describe('landing-content', () => {
  it('expõe a navegação do layout de marketing', () => {
    expect(NAV_LINKS.map((link) => link.label)).toEqual([
      'Como funciona',
      'Funcionalidades',
      'Planos',
      'Dúvidas',
    ]);
    expect(HELP_LINK).toEqual({ to: '/ajuda', label: 'Fale conosco' });
    expect(LEGAL_ENTITY).toEqual({
      legalName: 'SYNES TECH',
      cnpj: '47.465.014/0001-44',
    });
  });

  it('mantém o hero, as seções e os planos da nova landing', () => {
    expect(HERO.titleEmphasis).toBe('continua');
    expect(PILLARS).toHaveLength(3);
    expect(STEPS).toHaveLength(3);
    expect(FEATURES).toHaveLength(8);
    expect(WHY_ITEMS).toHaveLength(3);
    expect(SOCIAL_PROOF.testimonial.name).toBe('Livia S. Pavarini');
    expect(SOCIAL_PROOF.testimonial.linkedinUrl).toBe(
      'https://www.linkedin.com/in/livia-pavarini-376215315/',
    );
    expect(SOCIAL_PROOF.stats.map((stat) => stat.value)).toEqual(['8h+', '100%']);
    expect(FEATURES.find((item) => item.id === 'copiloto-chat')?.title).toBe(
      'IA personalizada para cada paciente',
    );
    expect(FEATURES.find((item) => item.id === 'financeiro')?.eyebrow).toBe('Módulo financeiro');
    expect(PAID_PLANS.map((plan) => plan.monthlyLabel)).toEqual([
      'R$ 237,00',
      'R$ 427,00',
      'R$ 657,00',
    ]);
    expect(PAID_PLANS.map((plan) => plan.yearlyLabel)).toEqual([
      'R$ 207,00',
      'R$ 377,00',
      'R$ 577,00',
    ]);
    expect(PAID_PLANS.map((plan) => plan.costPerPatientLabel)).toEqual([
      'Custo por paciente no plano',
      'Custo por paciente no plano',
      'Custo por paciente no plano',
    ]);
    expect(FREE_PLAN.name).toBe('Plano Degustação / Inicial');
    expect(FAQS).toHaveLength(7);
    expect(FINAL_CTA.titleLine2).toBe('Comece o teste gratuito hoje.');
  });

  it('mantém o copy do CTA final sem cartão e com os três selos', () => {
    expect(FINAL_CTA.eyebrow).toBe('Pronto para começar?');
    expect(FINAL_CTA.titleLine1).toBe('Devolva horas à sua semana.');
    expect(FINAL_CTA.body).toBe(
      'Crie sua conta no plano gratuito, sem cartão de crédito. Configure seu consultório em minutos e veja o primeiro relatório gerado por IA na próxima sessão.',
    );
    expect(FINAL_CTA.markers.map((marker) => marker.label)).toEqual([
      'LGPD-ready',
      'Plano gratuito sem cartão',
      'Setup em minutos',
    ]);
  });
});
