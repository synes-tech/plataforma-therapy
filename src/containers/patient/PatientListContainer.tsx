import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { getInitials } from '@shared/lib/greeting';
import { DiagnosisChips } from '@features/patients/DiagnosisChips';
import { StandardModal } from '@shared/ui/StandardModal';

interface Patient {
  id: string;
  name: string;
  birth_date: string;
  diagnoses: string[];
  status: string;
  created_at: string;
}

interface CreatePatientForm {
  name: string;
  birth_date: string;
  diagnoses: string;
  clinical_observations: string;
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

function getAge(birthDate: string): number {
  return Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

export default function PatientListContainer() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreatePatientForm>({
    name: '',
    birth_date: '',
    diagnoses: '',
    clinical_observations: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: () => callFunction<Patient[]>('list-patients', {}),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const diagnoses = form.diagnoses.split(',').map((d) => d.trim()).filter(Boolean);
      return callFunction('create-patient', {
        name: form.name,
        birth_date: form.birth_date,
        diagnoses,
        clinical_observations: form.clinical_observations || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setShowCreate(false);
      setForm({ name: '', birth_date: '', diagnoses: '', clinical_observations: '' });
      setCreateError(null);
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  function closeCreate() {
    setShowCreate(false);
    setCreateError(null);
  }

  const list = patients ?? [];

  return (
    <div className="bg-[#F8FAF9] px-5 py-6 lg:px-8 lg:py-8">
      {/* Page header */}
      <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
            Pacientes
          </h1>
          <p className="mt-1 text-sm text-charcoal-muted">
            Gerencie seus pacientes e gere convites para familiares.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] md:w-auto"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Paciente
        </button>
      </header>

      {/* Create modal */}
      <StandardModal
        isOpen={showCreate}
        onClose={closeCreate}
        title="Cadastrar paciente"
        size="xl"
        footer={
          <>
            <button
              type="button"
              onClick={closeCreate}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted transition-colors hover:bg-slate-100 md:w-auto"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="create-patient-form"
              disabled={createMutation.isPending}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] disabled:opacity-50 md:w-auto"
            >
              {createMutation.isPending ? 'Salvando...' : 'Cadastrar'}
            </button>
          </>
        }
      >
        {createError && (
          <div role="alert" className="mb-4 rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
            {createError}
          </div>
        )}
        <form
          id="create-patient-form"
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <FormInput label="Nome *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required placeholder="Nome do paciente" />
          <FormInput label="Data de Nascimento *" type="date" value={form.birth_date} onChange={(v) => setForm((f) => ({ ...f, birth_date: v }))} required />
          <div className="md:col-span-2">
            <FormInput label="Diagnósticos * (separados por vírgula)" value={form.diagnoses} onChange={(v) => setForm((f) => ({ ...f, diagnoses: v }))} required placeholder="TEA - Nível 1, TDAH" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-charcoal">Observações clínicas (opcional)</label>
            <textarea
              value={form.clinical_observations}
              onChange={(e) => setForm((f) => ({ ...f, clinical_observations: e.target.value }))}
              rows={3}
              placeholder="Informações adicionais relevantes..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            />
          </div>
        </form>
      </StandardModal>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <p className="text-sm text-charcoal-muted">Nenhum paciente cadastrado ainda.</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-sm font-medium text-primary hover:text-primary-dark">
            Cadastrar o primeiro paciente
          </button>
        </div>
      ) : (
        <>
          {/* Desktop: continuous list surface */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm md:block">
            <div className="divide-y divide-slate-100">
              {list.map((patient) => (
                <PatientRow key={patient.id} patient={patient} />
              ))}
            </div>
          </div>

          {/* Mobile: compact cards */}
          <div className="space-y-3 md:hidden">
            {list.map((patient) => (
              <PatientCardMobile key={patient.id} patient={patient} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Shared invite state/logic for a single patient. */
function useInvite(patientId: string) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const result = await callFunction<{ code: string; expires_at: string }>('generate-invite', {
        patient_id: patientId,
        relationship: 'responsável',
        expires_in_hours: 72,
      });
      setCode(result.code);
    } catch {
      // erro silencioso — futuro: toast
    } finally {
      setLoading(false);
    }
  }

  function copy() {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return { open, setOpen, code, loading, copied, generate, copy };
}

function PatientRow({ patient }: { patient: Patient }) {
  const invite = useInvite(patient.id);
  const age = getAge(patient.birth_date);

  return (
    <div className="transition-colors hover:bg-slate-50/60">
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Identidade */}
        <div className="flex w-60 shrink-0 items-center gap-3">
          <Avatar name={patient.name} />
          <div className="min-w-0">
            <p className="truncate font-medium text-charcoal">{patient.name}</p>
            <p className="text-sm text-charcoal-muted">{age} anos</p>
          </div>
        </div>
        {/* Diagnósticos */}
        <div className="min-w-0 flex-1">
          <DiagnosisChips diagnoses={patient.diagnoses} max={4} />
        </div>
        {/* Status + ação */}
        <div className="flex shrink-0 items-center gap-3">
          <StatusBadge status={patient.status} />
          <InviteButton active={invite.open} onClick={() => invite.setOpen((v) => !v)} />
        </div>
      </div>

      {invite.open && (
        <div className="px-5 pb-4">
          <InvitePanel invite={invite} />
        </div>
      )}
    </div>
  );
}

function PatientCardMobile({ patient }: { patient: Patient }) {
  const invite = useInvite(patient.id);
  const age = getAge(patient.birth_date);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar name={patient.name} />
        <div className="min-w-0">
          <p className="truncate font-medium text-charcoal">{patient.name}</p>
          <p className="text-sm text-charcoal-muted">{age} anos</p>
        </div>
      </div>

      <div className="mt-3">
        <DiagnosisChips diagnoses={patient.diagnoses} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-3">
        <StatusBadge status={patient.status} />
        <InviteButton active={invite.open} onClick={() => invite.setOpen((v) => !v)} withLabel />
      </div>

      {invite.open && <InvitePanel invite={invite} className="mt-3" />}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
      {getInitials(name)}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusClass(status)}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function InviteButton({ active, onClick, withLabel }: { active: boolean; onClick: () => void; withLabel?: boolean }) {
  return (
    <button
      onClick={onClick}
      title="Gerar convite familiar"
      aria-label="Gerar convite familiar"
      aria-expanded={active}
      className={`inline-flex items-center gap-1.5 rounded-md p-2 text-sm font-medium transition-colors ${
        active ? 'bg-primary-50 text-primary' : 'text-charcoal-muted/60 hover:bg-primary-50 hover:text-primary'
      }`}
    >
      <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h10m4-7v6m3-3h-6" />
      </svg>
      {withLabel && <span>Convite</span>}
    </button>
  );
}

interface InviteState {
  code: string | null;
  loading: boolean;
  copied: boolean;
  generate: () => void;
  copy: () => void;
}

function InvitePanel({ invite, className = '' }: { invite: InviteState; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-100 bg-slate-50/70 p-3 ${className}`}>
      {invite.code ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-lg bg-white px-4 py-2.5">
            <p className="text-[10px] text-charcoal-muted">Código de convite (válido por 72h)</p>
            <code className="mt-0.5 block font-mono text-base font-semibold tracking-widest text-primary">
              {invite.code}
            </code>
          </div>
          <button
            onClick={invite.copy}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-charcoal-muted transition-colors hover:border-primary/40 hover:text-primary"
          >
            {invite.copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      ) : (
        <button
          onClick={invite.generate}
          disabled={invite.loading}
          className="inline-flex items-center gap-2 rounded-lg bg-ai-50 px-4 py-2.5 text-xs font-medium text-ai transition-colors hover:bg-ai-glow disabled:opacity-50"
        >
          {invite.loading ? 'Gerando...' : 'Gerar código de convite'}
        </button>
      )}
    </div>
  );
}

function FormInput({ label, value, onChange, type = 'text', required = false, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-charcoal">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
      />
    </div>
  );
}
