import { useEffect, useState } from 'react';
import { clinicalAlertsButtonLabel, clinicalAlertsButtonTone } from './clinical-alerts.utils';
import { ClinicalAlertsModal } from './ClinicalAlertsModal';
import { useAcknowledgeClinicalAlert, useClinicalAlerts } from './useClinicalAlerts';

export function ClinicalAlertsFeed() {
  const { data, isLoading, error } = useClinicalAlerts();
  const acknowledge = useAcknowledgeClinicalAlert();
  const [open, setOpen] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());
  const alerts = data?.alerts ?? [];
  const count = data?.unread_count ?? alerts.length;
  const tone = clinicalAlertsButtonTone(data?.severe_unread_count ?? 0);

  useEffect(() => {
    if (open && !isLoading && alerts.length === 0 && !error) {
      setOpen(false);
    }
  }, [alerts.length, error, isLoading, open]);

  function handleAcknowledge(alertId: string) {
    setRemovingIds((prev) => new Set(prev).add(alertId));
    window.setTimeout(() => {
      acknowledge.mutate(alertId, {
        onError: () => {
          setRemovingIds((prev) => {
            const next = new Set(prev);
            next.delete(alertId);
            return next;
          });
        },
      });
    }, 280);
  }

  if (isLoading && alerts.length === 0 && !error) return null;
  if (!error && count === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-11 max-w-full shrink-0 items-center justify-center rounded-xl px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-white shadow-sm transition-transform active:scale-[0.98] sm:text-xs lg:h-9 lg:min-h-9 lg:px-3 lg:py-0 ${
          error || tone === 'severe' ? 'bg-error hover:bg-error/90' : 'bg-alert hover:bg-alert/90'
        }`}
      >
        {error ? 'Atenção, não foi possível carregar os alertas' : clinicalAlertsButtonLabel(count)}
      </button>

      <ClinicalAlertsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        alerts={alerts}
        error={Boolean(error)}
        onAcknowledge={handleAcknowledge}
        acknowledgingId={acknowledge.isPending ? (acknowledge.variables ?? null) : null}
        removingIds={removingIds}
      />
    </>
  );
}
