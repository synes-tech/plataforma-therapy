import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { StudioRecorder } from '@features/reports/StudioRecorder';

interface EvolutionItem {
  schedule_id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  title: string | null;
  patient: { id: string; name: string } | null;
  evolution_status: 'pending' | 'draft' | 'approved';
  session_note_id: string | null;
}

interface PendingData {
  date: string;
  items: EvolutionItem[];
  summary: { total: number; pending: number; done: number };
}

const STATUS_META: Record<EvolutionItem['evolution_status'], { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-50 text-amber-700' },
  draft: { label: 'Rascunho', className: 'bg-blue-50 text-blue-700' },
  approved: { label: 'Concluído', className: 'bg-emerald-50 text-emerald-700' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function ReportsCentral() {
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pending-evolutions'],
    queryFn: () => callFunction<PendingData>('list-pending-evolutions', {}),
  });

  const items = data?.items ?? [];
  const selected = items.find((i) => i.schedule_id === selectedId) ?? null;

  function handleSelect(item: EvolutionItem) {
    if (!item.patient) return;
    setSelectedId(item.schedule_id);
    if (isMobile) setSheetOpen(true);
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#F8FAF9] px-5 py-6 lg:min-h-dvh lg:px-8 lg:py-8">
      {/* Header */}
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
          Relatórios Clínicos
        </h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          Gere evoluções (SOAP) automaticamente a partir do seu áudio.
        </p>
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
          Não foi possível carregar a fila de evoluções. Tente novamente.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* COLUNA ESQUERDA — Fila de Evoluções (35%) */}
        <section className="lg:col-span-4">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Pendentes hoje</h2>
            </div>

            {isLoading ? (
              <div className="space-y-px">
                <div className="h-20 animate-pulse bg-slate-50" />
                <div className="h-20 animate-pulse bg-slate-50" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-charcoal-muted">Nenhuma sessão agendada para hoje.</p>
                <p className="mt-1 text-xs text-charcoal-muted/60">As evoluções a fazer aparecem aqui.</p>
              </div>
            ) : (
              <ul>
                {items.map((item) => {
                  const meta = STATUS_META[item.evolution_status];
                  const isActive = !isMobile && item.schedule_id === selectedId;
                  return (
                    <li key={item.schedule_id}>
                      <button
                        onClick={() => handleSelect(item)}
                        className={`flex w-full items-center justify-between gap-3 border-b border-slate-50 border-l-4 px-4 py-4 text-left transition-colors last:border-b-0 ${
                          isActive
                            ? 'border-l-blue-600 bg-blue-50'
                            : 'border-l-transparent hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="font-mono text-sm text-slate-400">{formatTime(item.scheduled_at)}</span>
                          <span className="truncate text-sm font-medium text-charcoal">
                            {item.patient?.name ?? item.title ?? 'Sessão'}
                          </span>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>
                          {meta.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* COLUNA DIREITA — Estúdio de Ditado (65%) — apenas desktop */}
        <section className="hidden lg:col-span-8 lg:block">
          <div className="flex min-h-[28rem] flex-col rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
            {!selected || !selected.patient ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-500">
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                </div>
                <p className="font-serif text-lg text-charcoal">Selecione uma sessão</p>
                <p className="mt-1 max-w-xs text-sm text-charcoal-muted">
                  Escolha uma sessão pendente à esquerda para iniciar o ditado da evolução.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-2xl text-charcoal">Evolução: {selected.patient.name}</h2>
                    <p className="mt-0.5 text-sm text-charcoal-muted">
                      Sessão de hoje, {formatTime(selected.scheduled_at)}
                    </p>
                  </div>
                  <Link
                    to={`/copilot/${selected.patient.id}`}
                    className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    Ver histórico
                  </Link>
                </div>

                <StudioRecorder
                  key={selected.patient.id}
                  patientId={selected.patient.id}
                  patientName={selected.patient.name}
                  enableReview
                  onSaved={() => refetch()}
                />
              </>
            )}
          </div>
        </section>
      </div>

      {/* MOBILE — Bottom Sheet apenas com microfone + timer */}
      <StandardModal
        isOpen={isMobile && sheetOpen && !!selected?.patient}
        onClose={() => setSheetOpen(false)}
        title={selected?.patient ? `Evolução: ${selected.patient.name}` : 'Evolução'}
        size="md"
      >
        {selected?.patient && (
          <StudioRecorder
            key={selected.patient.id}
            patientId={selected.patient.id}
            patientName={selected.patient.name}
            enableReview={false}
            onSaved={() => {
              refetch();
              setSheetOpen(false);
            }}
          />
        )}
      </StandardModal>
    </div>
  );
}
