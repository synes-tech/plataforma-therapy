import { describe, expect, it } from 'vitest';
import { TIMELINE_DECISION, TIMELINE_INSIGHT, TIMELINE_PREVIEW } from './landing-content';
import { isTimelineDecisionAwake, isTimelineInsightAwake, nextTimelineStep } from './landing-timeline';

describe('jornada da linha do tempo', () => {
  it('conta a semana até a decisão do psicólogo', () => {
    expect(TIMELINE_PREVIEW.map((item) => item.time)).toEqual([
      'Início da semana',
      'Ontem · 19:40',
      'Hoje · 07:12',
    ]);
    expect(TIMELINE_INSIGHT.kicker).toBe('Insight da IA');
    expect(TIMELINE_DECISION.kicker).toBe('Sua decisão');
  });

  it('avança a jornada e volta ao início depois da conduta', () => {
    expect(nextTimelineStep(0)).toBe(1);
    expect(nextTimelineStep(3)).toBe(4);
    expect(nextTimelineStep(4)).toBe(5);
    expect(nextTimelineStep(5)).toBe(0);
  });

  it('apaga o insight da IA quando a decisão do psicólogo acende', () => {
    expect(isTimelineInsightAwake(4)).toBe(true);
    expect(isTimelineDecisionAwake(4)).toBe(false);
    expect(isTimelineInsightAwake(5)).toBe(false);
    expect(isTimelineDecisionAwake(5)).toBe(true);
  });
});
