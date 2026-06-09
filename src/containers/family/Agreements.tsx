import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';

interface Agreement {
  id: string;
  patient_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'done';
  completed_at: string | null;
  created_at: string;
}

export default function Agreements() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['agreements'],
    queryFn: () => callFunction<{ agreements: Agreement[] }>('list-agreements', {}),
  });

  const toggle = useMutation({
    mutationFn: (vars: { id: string; done: boolean }) =>
      callFunction('toggle-agreement', { agreement_id: vars.id, done: vars.done }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['agreements'] });
      const prev = queryClient.getQueryData<{ agreements: Agreement[] }>(['agreements']);
      queryClient.setQueryData<{ agreements: Agreement[] }>(['agreements'], (old) =>
        old
          ? {
              agreements: old.agreements.map((a) =>
                a.id === vars.id ? { ...a, status: vars.done ? 'done' : 'pending' } : a,
              ),
            }
          : old,
      );
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['agreements'], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agreements'] }),
  });

  const agreements = data?.agreements ?? [];
  const pending = agreements.filter((a) => a.status === 'pending');
  const done = agreements.filter((a) => a.status === 'done');

  return (
    <div className="animate-fade-in">
      <header className="mb-6 lg:mb-8">
        <h1 className="font-serif text-2xl tracking-tight text-charcoal lg:text-3xl">Combinados</h1>
        <p className="mt-1 text-sm text-charcoal-muted lg:text-base">
          Orientações que o terapeuta combinou para praticar em casa.
        </p>
      </header>

      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-error/15 bg-error-light/40 px-4 py-3 text-sm text-error">
          {error instanceof Error ? error.message : 'Erro ao carregar combinados'}
        </div>
      )}

      {!isLoading && !error && agreements.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-6 w-6 text-charcoal-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm text-charcoal-muted">Nenhum combinado por enquanto.</p>
          <p className="mt-1 max-w-xs text-xs text-charcoal-muted/70">
            Quando o terapeuta enviar uma orientação, ela aparecerá aqui.
          </p>
        </div>
      )}

      {(pending.length > 0 || done.length > 0) && (
        <div className={`gap-6 ${pending.length > 0 && done.length > 0 ? 'lg:grid lg:grid-cols-2' : ''}`}>
          {pending.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted/60">A praticar</h2>
              {pending.map((a) => (
                <AgreementCard key={a.id} agreement={a} onToggle={(done) => toggle.mutate({ id: a.id, done })} />
              ))}
            </section>
          )}

          {done.length > 0 && (
            <section className={`space-y-3 ${pending.length === 0 ? '' : 'mt-6 lg:mt-0'}`}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted/60">Concluídos</h2>
              {done.map((a) => (
                <AgreementCard key={a.id} agreement={a} onToggle={(done) => toggle.mutate({ id: a.id, done })} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function AgreementCard({ agreement, onToggle }: { agreement: Agreement; onToggle: (done: boolean) => void }) {
  const isDone = agreement.status === 'done';
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-soft transition-all ${
        isDone ? 'border-slate-200/60 opacity-70' : 'border-slate-200/80'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(!isDone)}
        aria-pressed={isDone}
        aria-label={isDone ? 'Marcar como pendente' : 'Marcar como feito'}
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          isDone ? 'border-mint bg-mint text-white' : 'border-slate-300 bg-white hover:border-primary'
        }`}
      >
        {isDone && (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium text-charcoal ${isDone ? 'line-through decoration-charcoal-muted/40' : ''}`}>
          {agreement.title}
        </p>
        {agreement.description && (
          <p className="mt-1 text-xs leading-relaxed text-charcoal-muted">{agreement.description}</p>
        )}
      </div>
    </div>
  );
}
