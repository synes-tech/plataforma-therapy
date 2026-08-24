import { describe, expect, it } from 'vitest';
import { FEATURES, SHOWCASE_DEMO } from './landing-content';
import {
  LANDING_LG_MIN_PX,
  nextDemoStep,
  nextShowcaseIndex,
  previousShowcaseIndex,
  shouldAlignActiveShowcaseTab,
  shouldScrollToShowcaseOnCardClick,
  showcaseCounter,
  showcaseScrollBehavior,
  showcaseTabScrollLeft,
  swipeIntent,
} from './landing-showcase.utils';

describe('carrossel de funcionalidades', () => {
  it('cobre as oito funcionalidades da vitrine', () => {
    expect(FEATURES).toHaveLength(8);
    expect(FEATURES.map((feature) => feature.id)).toEqual([
      'diario',
      'anexos',
      'copiloto-chat',
      'ditado',
      'agenda',
      'relatorios',
      'financeiro',
      'portal-familia',
    ]);
    expect(FEATURES.every((feature) => feature.points.length === 3 || feature.points.length === 2)).toBe(
      true,
    );
    expect(SHOWCASE_DEMO.diario.days).toHaveLength(5);
    expect(SHOWCASE_DEMO.portal.moods.map((mood) => mood.id)).toEqual(['bom', 'oscilou', 'dificil']);
    expect(SHOWCASE_DEMO.portal.humors).toHaveLength(4);
    expect(SHOWCASE_DEMO.portal.audio.transcript).toMatch(/escola/i);
  });

  it('navega em ciclo entre os slides', () => {
    expect(nextShowcaseIndex(0, 8)).toBe(1);
    expect(nextShowcaseIndex(7, 8)).toBe(0);
    expect(previousShowcaseIndex(0, 8)).toBe(7);
    expect(previousShowcaseIndex(3, 8)).toBe(2);
    expect(nextShowcaseIndex(0, 0)).toBe(0);
  });

  it('interpreta o arraste horizontal e formata o contador', () => {
    expect(swipeIntent(-80)).toBe('next');
    expect(swipeIntent(80)).toBe('previous');
    expect(swipeIntent(-12)).toBe('none');
    expect(showcaseCounter(2, 8)).toBe('03 / 08');
    expect(showcaseCounter(7, 8)).toBe('08 / 08');
  });

  it('avança as etapas internas das demonstrações', () => {
    expect(nextDemoStep(0, 3)).toBe(1);
    expect(nextDemoStep(2, 3)).toBe(0);
    expect(nextDemoStep(0, 0)).toBe(0);
  });

  it('rola até a demonstração só abaixo do breakpoint desktop', () => {
    expect(shouldScrollToShowcaseOnCardClick(375)).toBe(true);
    expect(shouldScrollToShowcaseOnCardClick(768)).toBe(true);
    expect(shouldScrollToShowcaseOnCardClick(LANDING_LG_MIN_PX - 1)).toBe(true);
    expect(shouldScrollToShowcaseOnCardClick(LANDING_LG_MIN_PX)).toBe(false);
  });

  it('desloca a tela sem animação quando o usuário pede menos movimento', () => {
    expect(showcaseScrollBehavior(true)).toBe('auto');
    expect(showcaseScrollBehavior(false)).toBe('smooth');
  });

  it('alinha a aba ativa à esquerda só no mobile', () => {
    expect(shouldAlignActiveShowcaseTab(375)).toBe(true);
    expect(shouldAlignActiveShowcaseTab(LANDING_LG_MIN_PX)).toBe(false);
  });

  it('calcula o scroll para trazer a aba ativa ao início da faixa', () => {
    expect(showcaseTabScrollLeft(220, 16, 0, 400)).toBe(204);
    expect(showcaseTabScrollLeft(16, 16, 180, 400)).toBe(180);
    expect(showcaseTabScrollLeft(-8, 0, 0, 200)).toBe(0);
    expect(showcaseTabScrollLeft(900, 0, 0, 240)).toBe(240);
  });
});
