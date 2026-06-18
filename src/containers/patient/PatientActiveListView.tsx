import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { callFunction } from '@shared/lib/api';
import { DiagnosisChips } from '@features/patients/DiagnosisChips';
import { usePaywall } from '@containers/paywall';
import { PatientCreateModal } from './PatientCreateModal';
import { PatientAvatar } from './PatientAvatar';
import {
  PatientFamilyInviteButton,
  PatientFamilyInvitePanel,
  usePatientFamilyInvite,
} from './PatientFamilyInvite';

interface Patient {
  id: string;
  name: string;
  birth_date: string;
  diagnoses: string[];
  status: string;
  created_at: string;
  foto_url?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  inactive: 'Inativo',
  suspended: 'Suspenso',
};

function statusClass(status: string): string {
  if (status === 'active') return 'bg-mint-50 text-mint-dark';
  if (status === 'suspended') return 'bg-error-light text-error';
  return 'bg-slate-100 text-charcoal-muted';
}

function statusDotClass(status: string): string {
  if (status === 'active') return 'bg-mint';
  if (status === 'suspended') return 'bg-error';
  return 'bg-slate-400';
}

function getAge(birthDate: string): number {
  return Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

export function PatientActiveListView() {
  const { interceptNewPatient } = usePaywall();
  const [showCreate, setShowCreate] = useState(false);

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: () => callFunction<Patient[]>('list-patients', {}),
  });

  function openCreateModal() {
    interceptNewPatient(() => setShowCreate(true));
  }

  const list = patients ?? [];

  return (
    <>
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] sm:w-auto"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Paciente
        </button>
      </div>

      <PatientCreateModal isOpen={showCreate} onClose={() => setShowCreate(false)} />

      {!isLoading && list.length > 0 && (
        <p className="mb-4 text-xs text-charcoal-muted/80">
          {list.length} {list.length === 1 ? 'paciente ativo' : 'pacientes ativos'}
        </p>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white shadow-sm" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-sm text-charcoal-muted">Nenhum paciente cadastrado ainda.</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98]"
          >
            Cadastrar o primeiro paciente
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((patient) => (
            <PatientListCard key={patient.id} patient={patient} />
          ))}
        </div>
      )}
    </>
  );
}

function PatientListCard({ patient }: { patient: Patient }) {
  const invite = usePatientFamilyInvite(patient.id);
  const navigate = useNavigate();
  const age = getAge(patient.birth_date);

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
        <button
          type="button"
          onClick={() => navigate(`/patients/${patient.id}`)}
          className="flex min-w-0 items-center gap-4 text-left transition-opacity hover:opacity-90 lg:w-56 lg:shrink-0"
        >
          <PatientAvatar name={patient.name} fotoUrl={patient.foto_url} size="md" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-charcoal">{patient.name}</p>
            <p className="mt-0.5 text-sm text-charcoal-muted">{age} anos</p>
          </div>
        </button>

        <div className="min-w-0 flex-1 border-t border-slate-50 pt-4 lg:border-t-0 lg:pt-0">
          <DiagnosisChips diagnoses={patient.diagnoses} max={4} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-50 pt-4 sm:justify-end lg:w-auto lg:shrink-0 lg:border-t-0 lg:pt-0">
          <StatusBadge status={patient.status} />
          <PatientFamilyInviteButton
            active={invite.open}
            onClick={() => invite.setOpen((v) => !v)}
          />
        </div>
      </div>

      {invite.open && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <PatientFamilyInvitePanel invite={invite} />
        </div>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusClass(status)}`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(status)}`}
        aria-hidden
      />
      {label}
    </span>
  );
}
