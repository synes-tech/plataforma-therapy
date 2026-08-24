import { useMemo } from 'react';
import { StandardModal } from '@shared/ui/StandardModal';
import { PatientAvatar } from '@containers/patient/PatientAvatar';
import type { WorkspacePatient } from './copilot-workspace.types';

interface TherapistCopilotPatientsModalProps {
  isOpen: boolean;
  patients: WorkspacePatient[];
  isLoading: boolean;
  onClose: () => void;
  onSelect: (patient: WorkspacePatient) => void;
  onCreatePatient?: () => void;
  emptyMessage?: string;
  selectLabel?: string;
  selectShortLabel?: string;
}

export function TherapistCopilotPatientsModal({
  isOpen,
  patients,
  isLoading,
  onClose,
  onSelect,
  onCreatePatient,
  emptyMessage = 'Para poder interagir com o copiloto é necessário cadastrar um paciente.',
  selectLabel = 'Interagir com os dados desse paciente',
  selectShortLabel = 'Interagir',
}: TherapistCopilotPatientsModalProps) {
  const sorted = useMemo(
    () => [...patients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [patients],
  );

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Todos os pacientes"
      size="2xl"
    >
      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Carregando pacientes">
          <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="px-2 py-8 text-center">
          <p className="text-sm leading-relaxed text-charcoal-muted">{emptyMessage}</p>
          {onCreatePatient ? (
            <button
              type="button"
              onClick={onCreatePatient}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
            >
              Cadastrar paciente
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sorted.map((patient) => (
            <li key={patient.id} className="flex min-w-0 items-center gap-3 py-3">
              <span className="shrink-0">
                <PatientAvatar name={patient.name} fotoUrl={patient.foto_url} size="sm" />
              </span>
              <p className="min-w-0 flex-1 truncate font-medium text-charcoal" title={patient.name}>
                {patient.name}
              </p>
              <button
                type="button"
                onClick={() => onSelect(patient)}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-dark sm:px-3.5"
              >
                <span className="md:hidden">{selectShortLabel}</span>
                <span className="hidden md:inline">{selectLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </StandardModal>
  );
}
