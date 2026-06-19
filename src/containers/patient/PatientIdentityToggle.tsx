interface PatientIdentityToggleProps {
  mode: 'own_cpf' | 'dependent';
  onChange: (mode: 'own_cpf' | 'dependent') => void;
  disabled?: boolean;
}

export function PatientIdentityToggle({ mode, onChange, disabled }: PatientIdentityToggleProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-charcoal">O paciente possui CPF próprio?</legend>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label
          className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
            mode === 'own_cpf'
              ? 'border-primary bg-primary-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          <input
            type="radio"
            name="patient-identity-mode"
            value="own_cpf"
            checked={mode === 'own_cpf'}
            onChange={() => onChange('own_cpf')}
            disabled={disabled}
            className="h-4 w-4 border-slate-300 text-primary focus:ring-primary/20"
          />
          <span className="text-sm font-medium text-charcoal">Sim, possui CPF</span>
        </label>
        <label
          className={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
            mode === 'dependent'
              ? 'border-primary bg-primary-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        >
          <input
            type="radio"
            name="patient-identity-mode"
            value="dependent"
            checked={mode === 'dependent'}
            onChange={() => onChange('dependent')}
            disabled={disabled}
            className="h-4 w-4 border-slate-300 text-primary focus:ring-primary/20"
          />
          <span className="text-sm font-medium text-charcoal">Não, usar dados do responsável</span>
        </label>
      </div>
    </fieldset>
  );
}
