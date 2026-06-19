import { useNavigate } from 'react-router-dom';
import { DiagnosisChips } from '@features/patients/DiagnosisChips';
import { PatientAvatar } from './PatientAvatar';
import type { PatientListItem } from './patient-list.types';
import { getPatientAge, STATUS_LABEL, statusClass, statusDotClass } from './patient-list.utils';

interface PatientActiveTableProps {
  patients: PatientListItem[];
}

export function PatientActiveTable({ patients }: PatientActiveTableProps) {
  const navigate = useNavigate();

  return (
    <>
      {/* Desktop: tabela */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
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
                  <button
                    type="button"
                    onClick={() => navigate(`/patients/${patient.id}/copilot`)}
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
                  <StatusBadge status={patient.status} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => navigate(`/patients/${patient.id}/copilot`)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-charcoal px-3.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98]"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Central
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards compactos */}
      <div className="divide-y divide-slate-100 md:hidden">
        {patients.map((patient) => (
          <article key={patient.id} className="px-4 py-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => navigate(`/patients/${patient.id}/copilot`)}
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
              <StatusBadge status={patient.status} />
            </div>
            <div className="mt-3">
              <DiagnosisChips diagnoses={patient.diagnoses} max={3} />
            </div>
            <button
              type="button"
              onClick={() => navigate(`/patients/${patient.id}/copilot`)}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-charcoal px-3.5 text-xs font-medium text-white"
            >
              Central do Paciente
            </button>
          </article>
        ))}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(status)}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(status)}`} aria-hidden />
      {label}
    </span>
  );
}
