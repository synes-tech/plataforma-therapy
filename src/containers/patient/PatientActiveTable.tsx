import { useNavigate } from 'react-router-dom';
import { DiagnosisChips } from '@features/patients/DiagnosisChips';
import { PatientAvatar } from './PatientAvatar';
import { PatientCareTrackBadge } from './PatientCareTrackBadge';
import { PatientListActionsMenu } from './PatientListActionsMenu';
import type { PatientListItem } from './patient-list.types';
import { getPatientAge, patientClinicalEditPath } from './patient-list.utils';

interface PatientActiveTableProps {
  patients: PatientListItem[];
  onDelete: (patient: PatientListItem) => void;
}

export function PatientActiveTable({ patients, onDelete }: PatientActiveTableProps) {
  const navigate = useNavigate();

  function openRecord(patientId: string) {
    navigate(`/patients/${patientId}/copilot`);
  }

  function openEdit(patientId: string) {
    navigate(patientClinicalEditPath(patientId));
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
              <th className="px-5 py-3 font-semibold">Paciente</th>
              <th className="px-5 py-3 font-semibold">Idade</th>
              <th className="px-5 py-3 font-semibold">Diagnósticos</th>
              <th className="px-5 py-3 font-semibold">Acompanhamento</th>
              <th className="px-5 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patients.map((patient) => (
              <tr key={patient.id} className="transition-colors hover:bg-slate-50/60">
                <td className="px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => openRecord(patient.id)}
                    className="flex min-w-0 items-center gap-3 text-left transition-opacity hover:opacity-90"
                  >
                    <PatientAvatar name={patient.name} fotoUrl={patient.foto_url} size="sm" />
                    <span className="truncate font-medium text-charcoal">{patient.name}</span>
                  </button>
                </td>
                <td className="px-5 py-3.5 text-charcoal-muted">{getPatientAge(patient.birth_date)} anos</td>
                <td className="px-5 py-3.5">
                  <DiagnosisChips diagnoses={patient.diagnoses} max={3} />
                </td>
                <td className="px-5 py-3.5">
                  <PatientCareTrackBadge patient={patient} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <PatientListActionsMenu
                    onOpenCentral={() => openRecord(patient.id)}
                    onEdit={() => openEdit(patient.id)}
                    onDelete={() => onDelete(patient)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {patients.map((patient) => (
          <article key={patient.id} className="px-4 py-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => openRecord(patient.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <PatientAvatar name={patient.name} fotoUrl={patient.foto_url} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-charcoal">{patient.name}</p>
                  <p className="mt-0.5 text-xs text-charcoal-muted">
                    {getPatientAge(patient.birth_date)} anos
                  </p>
                </div>
              </button>
              <PatientCareTrackBadge patient={patient} />
            </div>
            <div className="mt-3">
              <DiagnosisChips diagnoses={patient.diagnoses} max={3} />
            </div>
            <div className="mt-3">
              <PatientListActionsMenu
                compact={false}
                onOpenCentral={() => openRecord(patient.id)}
                onEdit={() => openEdit(patient.id)}
                onDelete={() => onDelete(patient)}
              />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
