import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { formatCpfDisplay } from '@shared/lib/cpf';
import { DiagnosisChips } from '@features/patients/DiagnosisChips';
import { PatientAvatar } from './PatientAvatar';
import { PatientArchiveEmptyState } from './PatientArchiveEmptyState';
import { PatientArchiveHardDeleteFlow } from './PatientArchiveHardDeleteFlow';
import { PatientArchiveReactivateFlow } from './PatientArchiveReactivateFlow';
import { filterArchivedPatients, formatArchiveLicenseLabel } from './patient-archive.utils';
import type { ArchivedPatient, ArchivedPatientsPayload } from './patient-archive.types';

function getAge(birthDate: string): number {
  return Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

export function PatientArchiveListView() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['archived-patients'],
    queryFn: () => callFunction<ArchivedPatientsPayload>('get-archived-patients', {}),
  });

  const patients = data?.patients ?? [];
  const filtered = useMemo(
    () => filterArchivedPatients(patients, search),
    [patients, search],
  );

  const licenseLabel = formatArchiveLicenseLabel(
    data?.archived_count ?? 0,
    data?.quantidade_backup_pacientes ?? 0,
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gray-50 px-4 py-4 sm:px-5">
        <p className="text-sm font-medium text-gray-600">{licenseLabel}</p>
        <p className="mt-1 text-xs text-gray-500">
          Histórico clínico preservado em armazenamento a frio. Pacientes aqui não ocupam vagas ativas.
        </p>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou CPF..."
          aria-label="Buscar pacientes arquivados"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-slate-300 focus:outline-none focus:ring-[3px] focus:ring-slate-100"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-100 bg-gray-50" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <PatientArchiveEmptyState />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-sm text-gray-600">Nenhum paciente encontrado para &quot;{search.trim()}&quot;.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((patient) => (
            <PatientArchiveCard key={patient.id} patient={patient} />
          ))}
        </div>
      )}
    </div>
  );
}

function PatientArchiveCard({ patient }: { patient: ArchivedPatient }) {
  const age = getAge(patient.birth_date);

  return (
    <article className="rounded-2xl border border-slate-200 bg-gray-50 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <PatientAvatar
            name={patient.name}
            fotoUrl={patient.foto_url}
            size="md"
            muted
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-600">{patient.name}</p>
            <p className="mt-0.5 text-sm text-gray-500">{age} anos</p>
            {patient.cpf && (
              <p className="mt-0.5 text-xs text-gray-400">CPF {formatCpfDisplay(patient.cpf)}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="min-w-0 sm:max-w-xs">
            <DiagnosisChips diagnoses={patient.diagnoses} max={3} className="opacity-70" />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[11rem]">
            <PatientArchiveReactivateFlow
              patientId={patient.id}
              dataDesvinculacao={patient.data_desvinculacao ?? null}
            />
            <PatientArchiveHardDeleteFlow patientId={patient.id} patientName={patient.name} />
          </div>
        </div>
      </div>
    </article>
  );
}
