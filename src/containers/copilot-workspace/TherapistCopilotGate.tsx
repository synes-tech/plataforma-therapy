import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { usePaywall } from '@containers/paywall';
import { PatientAvatar } from '@containers/patient/PatientAvatar';
import { PatientCreateModal } from '@containers/patient/PatientCreateModal';
import { DiagnosisChips } from '@features/patients/DiagnosisChips';
import { useAuth } from '@shared/hooks/useAuth';
import { TheryAvatar } from '@shared/ui/TheryAvatar';
import { filterWorkspacePatients, workspacePatientAgeLabel } from './copilot-workspace.utils';
import { IvyWelcomeHero } from './IvyWelcomeHero';
import { TherapistCopilotPatientsModal } from './TherapistCopilotPatientsModal';
import { useIvyWelcome } from './useIvyWelcome';
import type { WorkspacePatient } from './copilot-workspace.types';

export interface PatientContextGateCopy {
  title: string;
  bodyWithPatients: string;
  bodyEmpty: string;
  searchLabel: string;
  searchPlaceholder: string;
  listButton: string;
  emptyCta: string;
  dataTour: string;
  searchInputId: string;
  modalEmptyMessage: string;
  modalSelectLabel: string;
  modalSelectShortLabel: string;
}

export const COPILOT_GATE_COPY: PatientContextGateCopy = {
  title: 'Olá, eu sou a IVY, sua assistente',
  bodyWithPatients:
    'Para começar, escolha o paciente. Digite o nome ou abra a lista completa. Eu travo o contexto no prontuário dele — e só dele.',
  bodyEmpty: 'Para poder interagir com o copiloto é necessário cadastrar um paciente.',
  searchLabel: 'Buscar paciente',
  searchPlaceholder: 'Digite o nome do paciente...',
  listButton: 'Ver todos os pacientes',
  emptyCta: 'Cadastrar paciente',
  dataTour: 'copilot-gate',
  searchInputId: 'copilot-patient-search',
  modalEmptyMessage: 'Para poder interagir com o copiloto é necessário cadastrar um paciente.',
  modalSelectLabel: 'Interagir com os dados desse paciente',
  modalSelectShortLabel: 'Interagir',
};

interface TherapistCopilotGateProps {
  patients: WorkspacePatient[];
  isLoading: boolean;
  onSelect: (patient: WorkspacePatient) => void;
  copy?: PatientContextGateCopy;
  hero?: ReactNode;
  /** Apresentação da Ivy (zoom, confete e fala) — só na tela do copiloto. */
  welcome?: boolean;
}

export function TherapistCopilotGate({
  patients,
  isLoading,
  onSelect,
  copy = COPILOT_GATE_COPY,
  hero,
  welcome = false,
}: TherapistCopilotGateProps) {
  const { interceptNewPatient } = usePaywall();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ivy = useIvyWelcome(welcome, user?.id);
  const hasQuery = query.trim().length > 0;
  const hasPatients = patients.length > 0;
  const filtered = useMemo(() => filterWorkspacePatients(patients, query), [patients, query]);
  const showPicker = !welcome || ivy.showPicker;
  const title = welcome ? ivy.title ?? copy.title : copy.title;
  const body = welcome
    ? ivy.body ?? (isLoading || hasPatients ? copy.bodyWithPatients : copy.bodyEmpty)
    : isLoading || hasPatients
      ? copy.bodyWithPatients
      : copy.bodyEmpty;

  function openCreate() {
    interceptNewPatient(() => setCreateOpen(true));
  }

  useEffect(() => {
    if (!showPicker) return;
    inputRef.current?.focus();
  }, [showPicker]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const only = filtered[0];
    if (filtered.length === 1 && only) onSelect(only);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-[#F8FAF9]">
      <div className="mx-auto my-auto w-full max-w-2xl px-5 py-8" data-tour={copy.dataTour}>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex justify-center">
            {welcome && ivy.playIntro ? (
              <IvyWelcomeHero bursting={ivy.bursting} runId={ivy.runId} onReplay={ivy.replay} />
            ) : (
              (hero ?? <TheryAvatar pose="profile" size="md" decorative />)
            )}
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-charcoal md:text-4xl">
            {title}
            {ivy.caret === 'title' ? <span className="thery-caret-blink" aria-hidden>|</span> : null}
          </h1>
          <p
            className={`mx-auto mt-3 max-w-md text-sm leading-relaxed text-charcoal-muted md:text-base ${
              welcome && ivy.playIntro ? 'min-h-[4.5rem]' : ''
            }`}
          >
            {body}
            {ivy.caret === 'body' ? <span className="thery-caret-blink" aria-hidden>|</span> : null}
          </p>
          {welcome && ivy.playIntro && !showPicker ? (
            <button
              type="button"
              onClick={ivy.skip}
              className="mt-2 text-xs font-medium text-charcoal-muted underline-offset-2 hover:text-primary hover:underline"
            >
              Continuar
            </button>
          ) : null}
        </div>

        {!showPicker ? null : (
          <div className={welcome && ivy.playIntro ? 'animate-fade-in' : undefined}>
            {!isLoading && !hasPatients ? (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98]"
              >
                {copy.emptyCta}
              </button>
            ) : (
              <>
        <form onSubmit={handleSubmit} className="mb-3">
          <label htmlFor={copy.searchInputId} className="sr-only">
            {copy.searchLabel}
          </label>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-charcoal-muted/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              id={copy.searchInputId}
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              autoComplete="off"
              className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-charcoal shadow-sm placeholder:text-charcoal-muted/50 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            />
          </div>
        </form>

        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="mb-6 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-charcoal shadow-sm transition-colors hover:border-primary/30 hover:bg-primary-50/50"
        >
          {copy.listButton}
        </button>

        <div className="min-h-0 flex-1">
          {hasQuery && isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Buscando pacientes">
              <div className="h-16 animate-pulse rounded-2xl bg-white" />
              <div className="h-16 animate-pulse rounded-2xl bg-white" />
            </div>
          ) : hasQuery && filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-sm text-charcoal-muted">
              Nenhum paciente com “{query.trim()}”. Tente outro nome ou veja a lista completa.
            </p>
          ) : hasQuery ? (
            <ul className="space-y-2">
              {filtered.map((patient) => {
                const age = workspacePatientAgeLabel(patient.birth_date);
                return (
                  <li key={patient.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(patient)}
                      className="flex w-full items-center gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:border-primary/25 hover:bg-primary-50/40 hover:shadow-md"
                    >
                      <PatientAvatar name={patient.name} fotoUrl={patient.foto_url} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-charcoal">{patient.name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          {age ? <span className="text-xs text-charcoal-muted">{age}</span> : null}
                          {patient.diagnoses?.length ? (
                            <DiagnosisChips diagnoses={patient.diagnoses} max={2} />
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
              </>
            )}
          </div>
        )}
      </div>

      <PatientCreateModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />

      <TherapistCopilotPatientsModal
        isOpen={listOpen}
        patients={patients}
        isLoading={isLoading}
        emptyMessage={copy.modalEmptyMessage}
        selectLabel={copy.modalSelectLabel}
        selectShortLabel={copy.modalSelectShortLabel}
        onClose={() => setListOpen(false)}
        onCreatePatient={() => {
          setListOpen(false);
          openCreate();
        }}
        onSelect={(patient) => {
          setListOpen(false);
          onSelect(patient);
        }}
      />
    </div>
  );
}
