/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { isMultiTouch } from './lock-mobile-viewport';

describe('lockMobileViewport', () => {
  it('trata dois dedos como pinch', () => {
    expect(isMultiTouch(1)).toBe(false);
    expect(isMultiTouch(2)).toBe(true);
    expect(isMultiTouch(3)).toBe(true);
  });
});
