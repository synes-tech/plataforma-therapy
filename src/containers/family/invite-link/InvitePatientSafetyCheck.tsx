import type { InvitePreviewStatus } from './useInviteCodePreview';

interface InvitePatientSafetyCheckProps {
  status: InvitePreviewStatus;
  patientName: string | null;
  error: string | null;
  className?: string;
}

export function InvitePatientSafetyCheck({
  status,
  patientName,
  error,
  className = '',
}: InvitePatientSafetyCheckProps) {
  if (status === 'idle') {
    return (
      <p
        className={`rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs leading-relaxed text-charcoal-muted sm:px-4 sm:text-sm ${className}`.trim()}
      >
        Ao completar os 8 caracteres, mostraremos o nome do paciente vinculado a este código antes da
        confirmação.
      </p>
    );
  }

  if (status === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center gap-2 rounded-xl border border-primary/15 bg-primary-50/40 px-3 py-2.5 text-xs text-primary-dark sm:px-4 sm:text-sm ${className}`.trim()}
      >
        <span className="inline-flex gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
        </span>
        Verificando código de convite...
      </div>
    );
  }

  if (status === 'valid' && patientName) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`rounded-xl border border-mint/25 bg-mint/10 px-3 py-3 sm:px-4 ${className}`.trim()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-mint-dark sm:text-xs">
          Confirme antes de continuar
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-charcoal">
          Este código está vinculado ao paciente{' '}
          <span className="font-semibold text-charcoal">{patientName}</span>.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-charcoal-muted">
          Se o nome não corresponder ao dependente correto, pare aqui e peça um novo código ao terapeuta.
        </p>
      </div>
    );
  }

  if (status === 'invalid' && error) {
    return (
      <div
        role="alert"
        className={`rounded-xl border border-error/15 bg-error-light/40 px-3 py-2.5 text-xs text-error sm:px-4 sm:text-sm ${className}`.trim()}
      >
        {error}
      </div>
    );
  }

  return null;
}
