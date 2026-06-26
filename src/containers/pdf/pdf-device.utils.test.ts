import { describe, expect, it, vi, afterEach } from 'vitest';
import { isDesktopPdfDelivery } from './pdf-device.utils';

function mockMatchMedia(queries: Record<string, boolean>) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: queries[query] ?? false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('isDesktopPdfDelivery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retorna true em ambiente com hover/pointer fine (desktop)', () => {
    mockMatchMedia({ '(hover: none) and (pointer: coarse)': false });
    expect(isDesktopPdfDelivery()).toBe(true);
  });

  it('retorna false em dispositivo touch-primary (mobile)', () => {
    mockMatchMedia({ '(hover: none) and (pointer: coarse)': true });
    expect(isDesktopPdfDelivery()).toBe(false);
  });
});
