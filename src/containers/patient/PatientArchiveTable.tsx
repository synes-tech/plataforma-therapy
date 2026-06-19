import { DiagnosisChips } from '@features/patients/DiagnosisChips';
import { formatCpfDisplay } from '@shared/lib/cpf';
import { PatientAvatar } from './PatientAvatar';
import { PatientArchiveHardDeleteFlow } from './PatientArchiveHardDeleteFlow';
import { PatientArchiveReactivateFlow } from './PatientArchiveReactivateFlow';
import type { ArchivedPatient } from './patient-archive.types';
import { getPatientAge } from './patient-list.utils';
import {
  formatAvailableDateLabel,
  formatCooldownBadge,
  getReactivationCooldownStatus,
} from './patient-reactivation-cooldown.utils';

interface PatientArchiveTableProps {
  patients: ArchivedPatient[];
}

export function PatientArchiveTable({ patients }: PatientArchiveTableProps) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
              <th className="px-5 py-3 font-semibold">Paciente</th>
              <th className="px-5 py-3 font-semibold">Idade</th>
              <th className="px-5 py-3 font-semibold">Diagnósticos</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.map((patient) => (
              <tr key={patient.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-3.5">
                  <PatientIdentityCell patient={patient} />
                </td>
                <td className="px-5 py-3.5 text-charcoal-muted">
                  {getPatientAge(patient.birth_date)} anos
                </td>
                <td className="px-5 py-3.5">
                  <DiagnosisChips diagnoses={patient.diagnoses} max={3} className="opacity-80" />
                </td>
                <td className="px-5 py-3.5">
                  <ArchiveBlockingStatus patient={patient} />
                </td>
                <td className="px-5 py-3.5">
                  <ArchiveActionsCell patient={patient} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="divide-y divide-slate-100 md:hidden">
        {patients.map((patient) => (
          <article key={patient.id} className="px-4 py-4">
            <div className="flex items-start gap-3">
              <PatientAvatar name={patient.name} fotoUrl={patient.foto_url} size="sm" muted />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-charcoal">{patient.name}</p>
                <p className="mt-0.5 text-xs text-charcoal-muted">
                  {getPatientAge(patient.birth_date)} anos
                </p>
                <IdentitySubline patient={patient} />
              </div>
            </div>

            <div className="mt-3">
              <DiagnosisChips diagnoses={patient.diagnoses} max={3} className="opacity-80" />
            </div>

            <div className="mt-3">
              <ArchiveBlockingStatus patient={patient} />
            </div>

            <div className="mt-3">
              <ArchiveActionsCell patient={patient} mobile />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function PatientIdentityCell({ patient }: { patient: ArchivedPatient }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PatientAvatar name={patient.name} fotoUrl={patient.foto_url} size="sm" muted />
      <div className="min-w-0">
        <p className="truncate font-medium text-charcoal">{patient.name}</p>
        <IdentitySubline patient={patient} />
      </div>
    </div>
  );
}

function IdentitySubline({ patient }: { patient: ArchivedPatient }) {
  if (patient.cpf_paciente) {
    return (
      <p className="mt-0.5 text-xs text-charcoal-muted/80">
        CPF {formatCpfDisplay(patient.cpf_paciente)}
      </p>
    );
  }

  if (patient.cpf_responsavel) {
    return (
      <p className="mt-0.5 text-xs text-charcoal-muted/80">
        {patient.nome_responsavel ? `${patient.nome_responsavel} · ` : ''}
        CPF resp. {formatCpfDisplay(patient.cpf_responsavel)}
      </p>
    );
  }

  return null;
}

function ArchiveBlockingStatus({ patient }: { patient: ArchivedPatient }) {
  const cooldown = getReactivationCooldownStatus(patient.data_desvinculacao);
  const availableLabel = formatAvailableDateLabel(cooldown.availableAt);

  if (cooldown.canReactivate) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-50 px-2.5 py-1 text-xs font-medium text-mint-dark ring-1 ring-mint/30">
        <span className="h-2 w-2 shrink-0 rounded-full bg-mint" aria-hidden />
        Pode reativar
      </span>
    );
  }

  return (
    <div className="max-w-[220px]">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
        <span aria-hidden>🔒</span>
        {formatCooldownBadge(cooldown)}
      </span>
      {availableLabel ? (
        <p className="mt-1 text-[10px] text-charcoal-muted">Disponível em {availableLabel}</p>
      ) : null}
    </div>
  );
}

function ArchiveActionsCell({
  patient,
  mobile = false,
}: {
  patient: ArchivedPatient;
  mobile?: boolean;
}) {
  return (
    <div className={mobile ? 'flex flex-col gap-2' : 'flex flex-col items-end gap-1.5'}>
      <div
        className={`flex items-center gap-2 ${mobile ? 'w-full' : 'justify-end'}`}
      >
        <PatientArchiveReactivateFlow
          patientId={patient.id}
          dataDesvinculacao={patient.data_desvinculacao ?? null}
          compact
          className={mobile ? 'flex-1' : undefined}
        />
        <PatientArchiveHardDeleteFlow
          patientId={patient.id}
          patientName={patient.name}
          compact
          className={mobile ? 'flex-1' : undefined}
        />
      </div>
    </div>
  );
}
