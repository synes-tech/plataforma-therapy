import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { PORTAL_CONTEXT_QUERY_KEY, usePortalContext } from '@shared/lib/portal-context';
import { StandardModal } from '@shared/ui/StandardModal';
import { TheryAvatar } from '@shared/ui/TheryAvatar';
import {
  showTherySubscriptionPanel,
  subscriptionPanelCopy,
} from './portal-subscription.utils';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 12;

export function PortalSubscriptionPanel() {
  const { data: portal } = usePortalContext();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const polling = useRef(false);

  const visible = showTherySubscriptionPanel(portal);
  const copy = subscriptionPanelCopy(
    portal?.subscription ?? null,
    Boolean(portal?.capabilities.can_subscribe),
  );

  useEffect(() => {
    if (searchParams.get('checkout') !== 'success' || polling.current) return;
    polling.current = true;

    let attempts = 0;
    let cancelled = false;

    const clearQuery = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('checkout');
      next.delete('session_id');
      setSearchParams(next, { replace: true });
    };

    const poll = async () => {
      attempts += 1;
      await queryClient.invalidateQueries({ queryKey: PORTAL_CONTEXT_QUERY_KEY });
      await queryClient.refetchQueries({ queryKey: PORTAL_CONTEXT_QUERY_KEY });
      const fresh = queryClient.getQueryData(PORTAL_CONTEXT_QUERY_KEY) as typeof portal;
      if (fresh?.capabilities.companion_chat || fresh?.subscription?.active) {
        if (!cancelled) {
          setNotice('Ivy liberada. Ela já está no centro do seu menu.');
          clearQuery();
        }
        return;
      }
      if (attempts < MAX_POLL_ATTEMPTS && !cancelled) {
        window.setTimeout(() => void poll(), POLL_INTERVAL_MS);
        return;
      }
      if (!cancelled) clearQuery();
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [queryClient, searchParams, setSearchParams]);

  if (!visible || !portal) return null;

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await callFunction<{ url: string }>('create-patient-checkout', {});
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o checkout.');
      setBusy(false);
    }
  };

  const confirmCancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await callFunction<{ message: string }>('cancel-patient-subscription', {
        action: 'confirm',
      });
      setConfirmOpen(false);
      setNotice(result.message);
      await queryClient.invalidateQueries({ queryKey: PORTAL_CONTEXT_QUERY_KEY });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cancelar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-primary/15 bg-white p-5 shadow-soft lg:mb-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">Acompanhante</p>
      <h2 className="mt-1 font-serif text-xl tracking-tight text-charcoal">{copy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-charcoal-muted">{copy.body}</p>

      {notice && (
        <p className="mt-3 rounded-xl bg-primary-50 px-3 py-2 text-sm text-primary" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl border border-error/15 bg-error-light/40 px-3 py-2 text-sm text-error" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {copy.cta === 'subscribe' && (
          <button
            type="button"
            onClick={() => void startCheckout()}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? 'Abrindo checkout…' : 'Assinar a Ivy'}
          </button>
        )}
        {copy.cta === 'cancel' && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal-muted hover:bg-slate-50"
          >
            Cancelar assinatura
          </button>
        )}
      </div>

      <StandardModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Tem certeza de que deseja cancelar a assinatura?"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted md:w-auto"
            >
              Manter
            </button>
            <button
              type="button"
              onClick={() => void confirmCancel()}
              disabled={busy}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-charcoal px-6 text-sm font-medium text-white md:w-auto"
            >
              {busy ? 'Cancelando…' : 'Confirmar cancelamento'}
            </button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center">
          <TheryAvatar pose="sad" size="lg" variant="figure" decorative />
          <p className="mt-4 text-sm leading-relaxed text-charcoal-muted">
            {portal.subscription?.status === 'trialing'
              ? 'O período grátis termina agora e o cartão não será cobrado. Você pode voltar quando quiser.'
              : 'Você mantém o acesso até o fim do período já pago. Nenhuma nova cobrança acontece.'}
          </p>
        </div>
      </StandardModal>
    </section>
  );
}
