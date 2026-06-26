import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { PatientAvatar } from '@containers/patient/PatientAvatar';
import { ChatArea } from '@features/copilot/ChatArea';
import { PatientSelector, type CopilotPatient } from '@features/copilot/PatientSelector';
import { PlanSidebar, type PlanItem } from '@features/copilot/PlanSidebar';
import { usePaywall } from '@containers/paywall';

export default function IACopilot() {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  const { interceptAiFeature, handlePaymentRequired } = usePaywall();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [planSheetOpen, setPlanSheetOpen] = useState(false);
  // Plano por paciente (isolamento também na UI)
  const [plansByPatient, setPlansByPatient] = useState<Record<string, PlanItem[]>>({});

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['copilot-patients'],
    queryFn: () => callFunction<CopilotPatient[]>('list-patients', {}),
  });

  const selected = patients.find((p) => p.id === patientId) ?? null;
  const planItems = patientId ? plansByPatient[patientId] ?? [] : [];

  // Fecha dropdown ao trocar de paciente
  useEffect(() => {
    setDropdownOpen(false);
  }, [patientId]);

  function handleSelect(patient: CopilotPatient) {
    navigate(`/copilot/${patient.id}`);
  }

  function handleRemoveFromPlan(id: string) {
    if (!patientId) return;
    setPlansByPatient((prev) => ({
      ...prev,
      [patientId]: (prev[patientId] ?? []).filter((i) => i.id !== id),
    }));
  }

  return (
    <div className="flex h-[calc(100dvh-66px)] flex-col overflow-hidden bg-[#F8FAF9] lg:h-dvh">
      {/* Header desktop */}
      <div className="hidden shrink-0 border-b border-slate-200 bg-white px-8 py-4 lg:block">
        <h1 className="font-serif text-xl font-medium tracking-tight text-charcoal">Copiloto Clínico</h1>
        <p className="mt-0.5 text-sm text-charcoal-muted">
          Planeje sessões com base no histórico isolado de cada paciente.
        </p>
      </div>

      {/* Barra de contexto mobile: seletor (dropdown) + plano */}
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 lg:hidden">
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-charcoal hover:bg-slate-50"
        >
          {selected ? (
            <PatientAvatar name={selected.name} fotoUrl={selected.foto_url} size="sm" />
          ) : null}
          <span className="truncate">{selected ? selected.name : 'Escolher paciente'}</span>
          <svg className="h-4 w-4 shrink-0 text-charcoal-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <button
          onClick={() => setPlanSheetOpen(true)}
          disabled={!selected}
          className="relative flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-charcoal disabled:opacity-40"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Plano
          {planItems.length > 0 && (
            <span className="ml-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] font-semibold text-white">
              {planItems.length}
            </span>
          )}
        </button>

        {/* Dropdown de pacientes (mobile) */}
        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-10 bg-slate-900/20" onClick={() => setDropdownOpen(false)} />
            <div className="absolute left-2 right-2 top-full z-20 mt-1 max-h-[60dvh] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
              <PatientSelector
                patients={patients}
                selectedId={patientId ?? null}
                onSelect={handleSelect}
                isLoading={isLoading}
                compact
              />
            </div>
          </>
        )}
      </div>

      {/* Corpo */}
      <div className="flex min-h-0 flex-1">
        {/* Coluna 1 — Seletor (desktop) */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex xl:w-80">
          <PatientSelector
            patients={patients}
            selectedId={patientId ?? null}
            onSelect={handleSelect}
            isLoading={isLoading}
          />
        </aside>

        {/* Coluna 2 — Chat */}
        <main className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <ChatArea
              key={selected.id}
              patientId={selected.id}
              patientName={selected.name}
              onBeforeSend={() => {
                let allowed = false;
                interceptAiFeature(() => {
                  allowed = true;
                });
                return allowed;
              }}
              onPaymentRequired={handlePaymentRequired}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8L12 2z" />
                </svg>
              </div>
              <p className="font-serif text-lg text-charcoal">Selecione um paciente</p>
              <p className="mt-1 max-w-xs text-sm text-charcoal-muted">
                Escolha um paciente para travar o contexto da IA 100% no histórico dele.
              </p>
            </div>
          )}
        </main>

        {/* Coluna 3 — Plano (desktop) */}
        <aside className="hidden w-72 shrink-0 flex-col border-l border-slate-200 bg-white lg:flex xl:w-80">
          <PlanSidebar
            patientId={selected?.id}
            patientName={selected?.name}
            items={planItems}
            onRemove={handleRemoveFromPlan}
          />
        </aside>
      </div>

      {/* Bottom sheet do Plano (mobile) */}
      <StandardModal
        isOpen={planSheetOpen}
        onClose={() => setPlanSheetOpen(false)}
        title="Plano de Sessão"
        size="md"
      >
        <div className="h-[60dvh]">
          <PlanSidebar
            patientId={selected?.id}
            patientName={selected?.name}
            items={planItems}
            onRemove={handleRemoveFromPlan}
          />
        </div>
      </StandardModal>
    </div>
  );
}
