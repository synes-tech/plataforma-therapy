import { useEffect, useState } from 'react';
import {
  dismissPushPrompt,
  getPushSupport,
  subscribeToPushNotifications,
  wasPushPromptDismissed,
  wasPushSubscribed,
} from '@shared/lib/push-notifications';

type PromptState = 'hidden' | 'visible' | 'loading' | 'success' | 'denied' | 'unsupported';

const SHOW_DELAY_MS = 2500;

/**
 * Banner contextual para ativar lembretes push (Portal da Família).
 * Não aparece no primeiro paint — aguarda engajamento na tela do diário.
 */
export function PushNotificationPrompt() {
  const [state, setState] = useState<PromptState>('hidden');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const permission = getPushSupport();

    if (permission === 'unsupported') {
      setState('unsupported');
      return;
    }

    if (permission === 'denied') {
      setState('denied');
      return;
    }

    if (permission === 'granted' && wasPushSubscribed()) {
      setState('hidden');
      return;
    }

    if (wasPushPromptDismissed()) {
      setState('hidden');
      return;
    }

    const timer = window.setTimeout(() => {
      if (getPushSupport() === 'default') {
        setState('visible');
      }
    }, SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  async function handleEnable() {
    setError(null);
    setState('loading');
    try {
      const result = await subscribeToPushNotifications();
      if (result === 'granted') {
        setState('success');
        window.setTimeout(() => setState('hidden'), 3000);
      } else if (result === 'denied') {
        setState('denied');
      } else {
        setState('unsupported');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ativar notificações');
      setState('visible');
    }
  }

  function handleDismiss() {
    dismissPushPrompt();
    setState('hidden');
  }

  if (state === 'hidden' || state === 'unsupported') return null;

  if (state === 'denied') {
    return (
      <div
        role="status"
        className="mb-5 rounded-2xl border border-slate-200/60 bg-white/70 px-4 py-3 text-sm text-charcoal-muted shadow-soft backdrop-blur-md"
      >
        <p className="font-medium text-charcoal">Notificações bloqueadas</p>
        <p className="mt-1 text-xs leading-relaxed">
          Para receber lembretes do diário, ative as notificações nas configurações do navegador ou do
          celular para este site.
        </p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div
        role="status"
        className="mb-5 rounded-2xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-mint-dark shadow-soft backdrop-blur-md"
      >
        Notificações ativadas! Enviaremos lembretes gentis quando o diário estiver em atraso.
      </div>
    );
  }

  if (state !== 'visible' && state !== 'loading') return null;

  return (
    <div
      role="dialog"
      aria-labelledby="push-prompt-title"
      className="mb-5 overflow-hidden rounded-2xl border border-charcoal/10 bg-charcoal/90 p-4 text-white shadow-lg backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <svg className="h-5 w-5 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="push-prompt-title" className="font-serif text-base tracking-tight">
            Lembretes do diário
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-white/75">
            Ative notificações para receber um lembrete amigável quando o diário de rotina estiver em
            atraso. Você pode desativar a qualquer momento.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-xs text-error-light">
              {error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleEnable}
              disabled={state === 'loading'}
              className="min-h-[44px] rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-charcoal transition-opacity hover:bg-white/90 disabled:opacity-60"
            >
              {state === 'loading' ? 'Ativando…' : 'Ativar notificações'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={state === 'loading'}
              className="min-h-[44px] rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
