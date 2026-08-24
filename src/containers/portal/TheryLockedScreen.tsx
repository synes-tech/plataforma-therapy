import { useState } from 'react';
import { callFunction } from '@shared/lib/api';
import { TheryAvatar } from '@shared/ui/TheryAvatar';
import { usePortalContext } from '@shared/lib/portal-context';
import { formatBrlCents, subscriptionPanelCopy, THERY_AMOUNT_CENTS } from './portal-subscription.utils';

interface TheryLockedScreenProps {
  firstName: string;
}

export function TheryLockedScreen({ firstName }: TheryLockedScreenProps) {
  const { data: portal } = usePortalContext();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = subscriptionPanelCopy(
    portal?.subscription ?? null,
    Boolean(portal?.capabilities.can_subscribe),
  );
  const name = firstName.trim() || 'você';

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const result = await callFunction<{ url: string }>('create-patient-checkout', {});
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o checkout.');
      setBusy(false);
    }
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[#F8FAF9] px-6 py-10"
      aria-label="Ivy"
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <TheryAvatar pose="profile" size="md" decorative />
        <p className="mt-6 font-serif text-3xl tracking-tight text-charcoal">Oi, {name}.</p>
        <p className="mt-2 font-display text-sm font-medium text-charcoal-muted">Ivy está aqui para conversar</p>
        <p className="mt-4 text-sm leading-relaxed text-charcoal-muted">
          Um espaço só seu, entre as sessões. Sem julgamento — e sem substituir o seu psicólogo.
        </p>
        <p className="mt-5 text-sm text-charcoal">
          7 dias grátis, depois {formatBrlCents(THERY_AMOUNT_CENTS)}/mês.
        </p>

        {copy.cta === 'subscribe' ? (
          <button
            type="button"
            onClick={() => void startCheckout()}
            disabled={busy}
            className="mt-6 inline-flex h-12 w-full max-w-xs items-center justify-center rounded-2xl bg-primary text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? 'Abrindo checkout…' : 'Começar a conversar'}
          </button>
        ) : (
          <p className="mt-6 text-sm text-charcoal-muted">{copy.body}</p>
        )}

        {error ? (
          <p className="mt-4 text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
