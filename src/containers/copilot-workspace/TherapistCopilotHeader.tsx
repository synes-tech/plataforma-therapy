import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { PatientAvatar } from '@containers/patient/PatientAvatar';
import { LayoutAccountSlot } from '@shared/ui/layout-account-context';
import type { WorkspacePatient } from './copilot-workspace.types';

interface TherapistCopilotHeaderProps {
  patient: WorkspacePatient;
  onChangePatient: () => void;
  backLink?: { to: string; label: string };
  actions?: ReactNode;
}

export function TherapistCopilotHeader({
  patient,
  onChangePatient,
  backLink,
  actions,
}: TherapistCopilotHeaderProps) {
  return (
    <header className="shrink-0 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md lg:h-14 lg:px-6 lg:py-0">
      <div className="flex flex-col gap-3 lg:h-full lg:flex-row lg:flex-nowrap lg:items-center lg:justify-between lg:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <PatientAvatar name={patient.name} fotoUrl={patient.foto_url} size="sm" />
          <p className="truncate text-sm font-medium text-charcoal lg:font-display lg:text-[20px] lg:font-semibold lg:leading-none">
            {patient.name}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:flex-nowrap lg:overflow-x-auto">
          {backLink ? (
            <Link
              to={backLink.to}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-charcoal transition-colors hover:border-primary/30 hover:bg-primary-50 lg:h-9 lg:min-h-9 lg:py-0"
            >
              {backLink.label}
            </Link>
          ) : null}
          <Link
            to={`/patients/${patient.id}`}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition-colors lg:h-9 lg:min-h-9 lg:py-0 ${
              actions
                ? 'border border-slate-200 bg-white font-medium text-charcoal hover:border-primary/30 hover:bg-primary-50'
                : 'bg-primary text-white hover:bg-primary-dark'
            }`}
          >
            Acessar central do paciente
          </Link>
          <button
            type="button"
            onClick={onChangePatient}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-charcoal transition-colors hover:border-primary/30 hover:bg-primary-50 lg:h-9 lg:min-h-9 lg:py-0"
          >
            Trocar paciente
          </button>
          {actions}
          <LayoutAccountSlot className="border-l border-slate-200 pl-3" />
        </div>
      </div>
    </header>
  );
}
