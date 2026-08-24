import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useClinicalAlerts } from './useClinicalAlerts';
import {
  clinicalRecordPath,
  newSevereAlertIds,
  readSeenSevereIds,
  writeSeenSevereIds,
} from './clinical-alerts.utils';
import type { ClinicalAlertItem } from './clinical-alerts.types';

/**
 * Toast global de SEVERE. A primeira carga só marca os IDs como vistos —
 * o terapeuta já vê o feed. O aviso flutua quando um alerta novo chega
 * enquanto a sessão está aberta (polling de 5 min).
 */
export function ClinicalSevereToast() {
  const { data } = useClinicalAlerts();
  const primedRef = useRef(false);
  const [toast, setToast] = useState<ClinicalAlertItem | null>(null);

  useEffect(() => {
    const alerts = data?.alerts ?? [];
    if (!data) return;

    const seen = readSeenSevereIds();
    if (!primedRef.current) {
      writeSeenSevereIds(new Set([...seen, ...alerts.filter((item) => item.severity === 'SEVERE').map((item) => item.id)]));
      primedRef.current = true;
      return;
    }

    const freshIds = newSevereAlertIds(alerts, seen);
    if (freshIds.length === 0) return;

    const nextSeen = new Set(seen);
    freshIds.forEach((id) => nextSeen.add(id));
    writeSeenSevereIds(nextSeen);

    const newest = alerts.find((item) => item.id === freshIds[0]);
    if (newest) setToast(newest);
  }, [data]);

  if (!toast) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-20 left-1/2 z-[60] w-[min(28rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-error/40 bg-white p-4 shadow-2xl lg:bottom-6"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-error">Risco de vida · Acompanhante</p>
      <p className="mt-1 font-display text-sm font-semibold text-charcoal">{toast.patient_name}</p>
      <p className="mt-1 text-sm leading-relaxed text-charcoal">{toast.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={clinicalRecordPath(toast.patient_id)}
          onClick={() => setToast(null)}
          className="inline-flex min-h-10 items-center rounded-xl bg-error px-3 text-sm font-semibold text-white"
        >
          Abrir prontuário
        </Link>
        <button
          type="button"
          onClick={() => setToast(null)}
          className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-charcoal"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
