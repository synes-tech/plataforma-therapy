import { PatientCpfField } from './PatientCpfField';

interface PatientResponsibleFieldsProps {
  nomeResponsavel: string;
  cpfResponsavel: string;
  onNomeChange: (value: string) => void;
  onCpfChange: (value: string) => void;
  cpfLoading?: boolean;
  cpfError?: string | null;
  disabled?: boolean;
}

export function PatientResponsibleFields({
  nomeResponsavel,
  cpfResponsavel,
  onNomeChange,
  onCpfChange,
  cpfLoading,
  cpfError,
  disabled,
}: PatientResponsibleFieldsProps) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
        Dados do Responsável
      </p>
      <div>
        <label htmlFor="responsavel-nome" className="mb-1.5 block text-sm font-medium text-charcoal">
          Nome do Responsável
        </label>
        <input
          id="responsavel-nome"
          type="text"
          value={nomeResponsavel}
          onChange={(e) => onNomeChange(e.target.value)}
          disabled={disabled}
          placeholder="Ex.: Maria Silva"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-charcoal placeholder:text-gray-400 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 disabled:opacity-60"
        />
      </div>
      <PatientCpfField
        id="responsavel-cpf"
        label="CPF do Responsável"
        value={cpfResponsavel}
        onChange={onCpfChange}
        loading={cpfLoading}
        error={cpfError}
        disabled={disabled}
      />
    </div>
  );
}
