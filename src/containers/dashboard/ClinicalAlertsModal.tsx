import { StandardModal } from '@shared/ui/StandardModal';
import { ClinicalAlertCard } from './ClinicalAlertCard';
import type { ClinicalAlertItem } from './clinical-alerts.types';
import { HOME_ATTENTION_EMPTY } from './home-layout.utils';

interface ClinicalAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: ClinicalAlertItem[];
  error?: boolean;
  onAcknowledge: (alertId: string) => void;
  acknowledgingId?: string | null;
  removingIds: ReadonlySet<string>;
}

export function ClinicalAlertsModal({
  isOpen,
  onClose,
  alerts,
  error,
  onAcknowledge,
  acknowledgingId,
  removingIds,
}: ClinicalAlertsModalProps) {
  return (
    <StandardModal isOpen={isOpen} onClose={onClose} title="Alertas clínicos" size="xl">
      <p className="mb-4 text-sm text-charcoal-muted">
        O que o Acompanhante e o diário sinalizaram entre as sessões — sem o conteúdo literal do chat.
      </p>

      {error ? (
        <p role="alert" className="rounded-xl border border-error/15 bg-error-light/50 px-4 py-3 text-sm text-error">
          Não foi possível carregar os alertas. Eles voltam no próximo carregamento.
        </p>
      ) : null}

      {!error && alerts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-charcoal">Nada para triar agora</p>
          <p className="mt-1 text-sm text-charcoal-muted">{HOME_ATTENTION_EMPTY}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {alerts.map((alert) => (
          <ClinicalAlertCard
            key={alert.id}
            alert={alert}
            onAcknowledge={onAcknowledge}
            acknowledging={acknowledgingId === alert.id}
            removing={removingIds.has(alert.id)}
          />
        ))}
      </div>
    </StandardModal>
  );
}
