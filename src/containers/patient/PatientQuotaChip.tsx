import { patientUsagePercent } from '@shared/lib/therapist-plans';
import {
  formatPatientQuotaLabel,
  patientQuotaRemaining,
  patientQuotaTone,
} from './patient-quota-chip.utils';

interface PatientQuotaChipProps {
  activeCount: number;
  totalLimit: number;
  onAmpliar: () => void;
}

const TONE_CLASS: Record<ReturnType<typeof patientQuotaTone>, string> = {
  ok: 'border-slate-200 bg-white text-charcoal',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
  full: 'border-error/25 bg-error-light/40 text-error',
};

export function PatientQuotaChip({ activeCount, totalLimit, onAmpliar }: PatientQuotaChipProps) {
  const tone = patientQuotaTone(activeCount, totalLimit);
  const remaining = patientQuotaRemaining(activeCount, totalLimit);
  const usage = patientUsagePercent(activeCount, totalLimit);

  return (
    <div className={`flex h-11 items-stretch overflow-hidden rounded-xl border shadow-sm lg:h-9 ${TONE_CLASS[tone]}`}>
      <div className="flex min-w-0 flex-col justify-center px-3 py-1 lg:flex-row lg:items-center lg:gap-2 lg:py-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 lg:hidden">Carteira</p>
        <p className="text-sm font-semibold tabular-nums leading-tight lg:text-xs">
          {formatPatientQuotaLabel(activeCount, totalLimit)}
        </p>
      </div>
      <button
        type="button"
        onClick={onAmpliar}
        aria-label={`Ampliar carteira. ${remaining} ${remaining === 1 ? 'vaga restante' : 'vagas restantes'} (${usage}% do plano).`}
        className="shrink-0 border-l border-current/15 px-3 text-xs font-semibold transition-colors hover:bg-black/5"
      >
        Ampliar carteira
      </button>
    </div>
  );
}
