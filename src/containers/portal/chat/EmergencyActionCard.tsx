import { COMPANION_EMERGENCY_HOTLINES } from './patient-chat.utils';

export function EmergencyActionCard() {
  return (
    <div
      className="mt-3 rounded-xl border border-alert/40 bg-amber-50/90 px-3 py-3"
      role="alert"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
        Acolhimento de emergência
      </p>
      <p className="mt-1 text-sm leading-relaxed text-charcoal">
        Peça ajuda humana agora. A Ivy já avisou o seu terapeuta — isso não substitui ligar.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {COMPANION_EMERGENCY_HOTLINES.map((line) => (
          <a
            key={line.id}
            href={line.href}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-alert px-3 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
            aria-label={`Ligar para o ${line.label}, ${line.number}`}
          >
            Ligar {line.number} · {line.label}
          </a>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-amber-900/80">
        {COMPANION_EMERGENCY_HOTLINES.map((line) => `${line.label} ${line.number} — ${line.hint}`).join(
          ' · ',
        )}
      </p>
    </div>
  );
}
