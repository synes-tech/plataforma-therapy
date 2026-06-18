/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { computePopoverPosition } from './calendar-day-action.utils';
import type { DayActionAnchor } from './calendar-day-action.types';

describe('calendar-day-action.utils', () => {
  const anchor: DayActionAnchor = {
    top: 400,
    left: 900,
    right: 980,
    bottom: 520,
    width: 80,
    height: 120,
  };

  it('posiciona abaixo da célula por padrão', () => {
    const pos = computePopoverPosition(anchor, 224, 108, { width: 1200, height: 800 });
    expect(pos.top).toBeGreaterThan(anchor.bottom);
    expect(pos.left).toBeGreaterThanOrEqual(8);
  });

  it('inverte para cima quando não cabe embaixo', () => {
    const lowAnchor: DayActionAnchor = {
      top: 700,
      left: 100,
      right: 180,
      bottom: 780,
      width: 80,
      height: 80,
    };
    const pos = computePopoverPosition(lowAnchor, 224, 108, { width: 400, height: 800 });
    expect(pos.top).toBeLessThan(lowAnchor.top);
  });

  it('empurra para dentro quando vaza à direita', () => {
    const rightAnchor: DayActionAnchor = {
      top: 200,
      left: 350,
      right: 390,
      bottom: 280,
      width: 40,
      height: 80,
    };
    const pos = computePopoverPosition(rightAnchor, 224, 108, { width: 400, height: 800 });
    expect(pos.left + 224).toBeLessThanOrEqual(400 - 8);
  });
});
