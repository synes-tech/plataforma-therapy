import { maskCpfInput } from '@shared/lib/cpf';
import { Spinner } from '@containers/loading';

interface PatientCpfFieldProps {
  value: string;
  onChange: (masked: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  id?: string;
  label?: string;
  hint?: string;
}

export function PatientCpfField({
  value,
  onChange,
  onBlur,
  disabled,
  loading,
  error,
  id = 'patient-cpf',
  label = 'CPF do paciente',
  hint = 'Digite o CPF para buscar no histórico ou iniciar um novo cadastro.',
}: PatientCpfFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-charcoal">
        {label}
      </label>
      {hint ? <p className="mb-2 text-xs text-charcoal-muted">{hint}</p> : null}
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          value={value}
          disabled={disabled}
          onBlur={onBlur}
          onChange={(e) => onChange(maskCpfInput(e.target.value))}
          className={`h-12 w-full rounded-xl border bg-white px-4 pr-11 text-base text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:outline-none focus:ring-[3px] disabled:bg-slate-50 ${
            error
              ? 'border-error/40 focus:border-error/50 focus:ring-error/10'
              : 'border-slate-200 focus:border-primary/50 focus:ring-primary/10'
          }`}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {loading && (
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <Spinner size="sm" />
          </div>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
