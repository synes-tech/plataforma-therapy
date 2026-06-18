import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dismissPushPrompt,
  getPushSupport,
  wasPushPromptDismissed,
} from './push-notifications';

describe('push-notifications', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('detecta unsupported quando APIs faltam', () => {
    const original = globalThis.Notification;
    // @ts-expect-error — simula ambiente sem Notification
    delete globalThis.Notification;
    expect(getPushSupport()).toBe('unsupported');
    globalThis.Notification = original;
  });

  it('persiste dismiss do banner', () => {
    expect(wasPushPromptDismissed()).toBe(false);
    dismissPushPrompt();
    expect(wasPushPromptDismissed()).toBe(true);
  });

  it('respeita permissão denied do navegador', () => {
    vi.stubGlobal('Notification', { permission: 'denied' });
    vi.stubGlobal('navigator', {
      serviceWorker: {},
    });
    vi.stubGlobal('PushManager', class {});
    expect(getPushSupport()).toBe('denied');
    vi.unstubAllGlobals();
  });
});
