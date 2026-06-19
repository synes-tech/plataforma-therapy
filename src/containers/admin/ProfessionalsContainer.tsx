import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListPageSkeleton, LoadingButton, PageLoader } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { getInitials } from '@shared/lib/greeting';
import { StandardModal } from '@shared/ui/StandardModal';
import { UpgradePlanModal } from '@containers/billing/UpgradePlanModal';

interface Professional {
  id: string;
  name: string;
  email: string;
  specialty: string | null;
  crp: string | null;
  status: string;
  created_at: string;
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

export default function ProfessionalsContainer() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', specialty: '', crp: '' });
  const [editForm, setEditForm] = useState({ name: '', specialty: '', crp: '' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');

  const { data: professionals, isLoading } = useQuery({
    queryKey: ['professionals'],
    queryFn: () => callFunction<Professional[]>('list-professionals', {}),
  });

  const createMutation = useMutation({
    mutationFn: () => callFunction('register-professional', {
      name: form.name,
      email: form.email,
      password: form.password,
      specialty: form.specialty || undefined,
      crp: form.crp || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', specialty: '', crp: '' });
      setCreateError(null);
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === 'QUOTA_EXCEEDED') {
        setUpgradeMessage(err.message);
        setUpgradeOpen(true);
        setCreateError(null);
        setShowCreate(false);
        return;
      }
      setCreateError(err.message);
    },
  });

  const editMutation = useMutation({
    mutationFn: (id: string) => callFunction('update-professional', {
      professional_id: id,
      name: editForm.name,
      specialty: editForm.specialty || undefined,
      crp: editForm.crp || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      setEditingId(null);
    },
  });

  function startEdit(prof: Professional) {
    setEditingId(prof.id);
    setEditForm({ name: prof.name, specialty: prof.specialty ?? '', crp: prof.crp ?? '' });
  }

  function closeCreate() {
    setShowCreate(false);
    setCreateError(null);
  }

  const list = professionals ?? [];

  if (isLoading && !professionals) {
    return <PageLoader label="Carregando profissionais..." className="min-h-[50vh]" />;
  }

  return (
    <div className="bg-[#F8FAF9] px-5 py-6 lg:px-8 lg:py-8">
      {/* Page header */}
      <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
            Profissionais
          </h1>
          <p className="mt-1 text-sm text-charcoal-muted">Gerencie os terapeutas da sua clínica.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] md:w-auto"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Profissional
        </button>
      </header>

      {/* Create modal */}
      <StandardModal
        isOpen={showCreate}
        onClose={closeCreate}
        title="Cadastrar profissional"
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
            <LoadingButton
              type="submit"
              form="create-professional-form"
              loading={createMutation.isPending}
              fullWidth
              className="md:w-auto"
            >
              Cadastrar
            </LoadingButton>
          </>
        }
      >
        {createError && (
          <div role="alert" className="mb-4 rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
            {createError}
          </div>
        )}
        <form id="create-professional-form" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput label="Nome *" value={form.name} onChange={(v) => setForm(f => ({ ...f, name: v }))} required placeholder="Dra. Maria Silva" />
          <FormInput label="Email *" type="email" value={form.email} onChange={(v) => setForm(f => ({ ...f, email: v }))} required placeholder="maria@clinica.com" />
          <FormInput label="Senha * (mín. 6 caracteres)" type="password" value={form.password} onChange={(v) => setForm(f => ({ ...f, password: v }))} required placeholder="Mínimo 6 caracteres" minLength={6} />
          <FormInput label="Especialidade" value={form.specialty} onChange={(v) => setForm(f => ({ ...f, specialty: v }))} placeholder="Psicóloga" />
          <FormInput label="CRP" value={form.crp} onChange={(v) => setForm(f => ({ ...f, crp: v }))} placeholder="CRP 06/123456" />
        </form>
      </StandardModal>

      {/* Loading */}
      {isLoading ? (
        <ListPageSkeleton rows={3} rowClassName="h-[4.5rem]" />
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <p className="text-sm text-charcoal-muted">Nenhum profissional cadastrado.</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-sm font-medium text-primary hover:text-primary-dark">
            Cadastrar o primeiro
          </button>
        </div>
      ) : (
        <>
          {/* Desktop: continuous list surface */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm md:block">
            <div className="divide-y divide-slate-100">
              {list.map((prof) => (
                <div key={prof.id} className="group transition-colors hover:bg-slate-50/60">
                  {editingId === prof.id ? (
                    <div className="p-5">
                      <EditForm
                        editForm={editForm}
                        setEditForm={setEditForm}
                        pending={editMutation.isPending}
                        onSubmit={() => editMutation.mutate(prof.id)}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 px-5 py-4">
                      {/* Identidade */}
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Avatar name={prof.name} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-charcoal">{prof.name}</p>
                          <p className="truncate text-sm text-charcoal-muted">{prof.email}</p>
                        </div>
                      </div>
                      {/* Especialidade */}
                      <div className="hidden w-44 shrink-0 lg:block">
                        <p className="text-sm text-charcoal-muted">{prof.specialty ?? '—'}</p>
                        {prof.crp && <p className="text-xs text-charcoal-muted/70">{prof.crp}</p>}
                      </div>
                      {/* Status + ação */}
                      <div className="flex shrink-0 items-center gap-3">
                        <StatusBadge status={prof.status} />
                        <EditButton name={prof.name} onClick={() => startEdit(prof)} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: compact cards */}
          <div className="space-y-3 md:hidden">
            {list.map((prof) => (
              <div key={prof.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                {editingId === prof.id ? (
                  <EditForm
                    editForm={editForm}
                    setEditForm={setEditForm}
                    pending={editMutation.isPending}
                    onSubmit={() => editMutation.mutate(prof.id)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar name={prof.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-charcoal">{prof.name}</p>
                        <p className="truncate text-sm text-charcoal-muted">{prof.specialty ?? '—'}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-3">
                      <p className="min-w-0 truncate pr-2 text-xs text-charcoal-muted">{prof.email}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={prof.status} />
                        <EditButton name={prof.name} onClick={() => startEdit(prof)} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <UpgradePlanModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        message={upgradeMessage}
      />
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
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

function EditButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md p-2 text-charcoal-muted/60 transition-colors hover:bg-primary-50 hover:text-primary"
      aria-label={`Editar ${name}`}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  );
}

function EditForm({
  editForm,
  setEditForm,
  pending,
  onSubmit,
  onCancel,
}: {
  editForm: { name: string; specialty: string; crp: string };
  setEditForm: React.Dispatch<React.SetStateAction<{ name: string; specialty: string; crp: string }>>;
  pending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FormInput label="Nome" value={editForm.name} onChange={(v) => setEditForm(f => ({ ...f, name: v }))} required />
        <FormInput label="Especialidade" value={editForm.specialty} onChange={(v) => setEditForm(f => ({ ...f, specialty: v }))} />
        <FormInput label="CRP" value={editForm.crp} onChange={(v) => setEditForm(f => ({ ...f, crp: v }))} />
      </div>
      <div className="flex gap-2">
        <LoadingButton type="submit" variant="dark" loading={pending} className="h-10 px-4 text-xs">
          Salvar
        </LoadingButton>
        <button type="button" onClick={onCancel} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-medium text-charcoal-muted transition-colors hover:bg-slate-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormInput({ label, value, onChange, type = 'text', required = false, placeholder, minLength }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string; minLength?: number;
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
        minLength={minLength}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
      />
    </div>
  );
}
