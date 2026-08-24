/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  IVY_CONFETTI_MS,
  IVY_WELCOME_HOLD_MS,
  hasSeenIvyWelcome,
  ivyConfettiPieces,
  ivyWelcomeHelloMs,
  ivyWelcomeStorageKey,
  ivyWelcomeView,
  markIvyWelcomeSeen,
} from './ivy-welcome.utils';

describe('ivyConfettiPieces', () => {
  it('gera um burst estável atrás da Ivy', () => {
    const pieces = ivyConfettiPieces();
    expect(pieces.length).toBeGreaterThanOrEqual(16);
    expect(new Set(pieces.map((piece) => piece.id)).size).toBe(pieces.length);
    expect(pieces.every((piece) => piece.color.startsWith('#'))).toBe(true);
  });
});

describe('ivyWelcomeView', () => {
  it('pula a festa quando a apresentação está desligada', () => {
    expect(
      ivyWelcomeView({
        enabled: false,
        reducedMotion: false,
        firstVisit: true,
        helloDone: false,
        holdElapsedMs: 0,
        runElapsedMs: 0,
      }),
    ).toEqual({ phase: 'select', showPicker: true, bursting: false });
  });

  it('respeita reduced motion', () => {
    expect(
      ivyWelcomeView({
        enabled: true,
        reducedMotion: true,
        firstVisit: true,
        helloDone: false,
        holdElapsedMs: 0,
        runElapsedMs: 80,
      }).bursting,
    ).toBe(false);
  });

  it('explode confete no começo e só libera a busca depois da apresentação', () => {
    const start = ivyWelcomeView({
      enabled: true,
      reducedMotion: false,
      firstVisit: true,
      helloDone: false,
      holdElapsedMs: 0,
      runElapsedMs: 120,
    });
    expect(start.phase).toBe('hello');
    expect(start.showPicker).toBe(false);
    expect(start.bursting).toBe(true);

    const afterConfetti = ivyWelcomeView({
      enabled: true,
      reducedMotion: false,
      firstVisit: true,
      helloDone: false,
      holdElapsedMs: 0,
      runElapsedMs: IVY_CONFETTI_MS + 10,
    });
    expect(afterConfetti.bursting).toBe(false);
    expect(afterConfetti.showPicker).toBe(false);

    const ready = ivyWelcomeView({
      enabled: true,
      reducedMotion: false,
      firstVisit: true,
      helloDone: true,
      holdElapsedMs: IVY_WELCOME_HOLD_MS,
      runElapsedMs: ivyWelcomeHelloMs() + IVY_WELCOME_HOLD_MS,
    });
    expect(ready.phase).toBe('select');
    expect(ready.showPicker).toBe(true);
  });

  it('na segunda visita fica estático, sem confete', () => {
    expect(
      ivyWelcomeView({
        enabled: true,
        reducedMotion: false,
        firstVisit: false,
        helloDone: false,
        holdElapsedMs: 0,
        runElapsedMs: 80,
      }),
    ).toEqual({ phase: 'select', showPicker: true, bursting: false });
  });
});

describe('ivy welcome storage', () => {
  it('grava a primeira visita por usuário', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };

    expect(ivyWelcomeStorageKey('u1')).toBe('unithery:ivy-welcome:u1');
    expect(hasSeenIvyWelcome('u1', storage)).toBe(false);
    markIvyWelcomeSeen('u1', storage);
    expect(hasSeenIvyWelcome('u1', storage)).toBe(true);
    expect(hasSeenIvyWelcome('u2', storage)).toBe(false);
  });
});
