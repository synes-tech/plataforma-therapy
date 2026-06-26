import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { SessionBriefCards } from '@features/family-portal/SessionBriefCards';

interface Agreement {
  id: string;
  patient_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'done';
  completed_at: string | null;
  created_at: string;
}

export interface LatestAgreementsData {
  patient_id: string;
  patient_name: string;
  last_session: {
    date: string;
    summary_for_family: string;
    plan_highlight: string;
  } | null;
  attention_points: string[];
  activity_suggestions: string[];
  clinical_summary: string;
  summary_updated_at: string | null;
  agreements: Agreement[];
}

interface FamilyReportsOverviewTabProps {
  data: LatestAgreementsData;
}

export function FamilyReportsOverviewTab({ data }: FamilyReportsOverviewTabProps) {
  const queryClient = useQueryClient();

  const toggle = useMutation({
    mutationFn: (vars: { id: string; done: boolean }) =>
      callFunction('toggle-agreement', { agreement_id: vars.id, done: vars.done }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['latest-agreements'] });
      const prev = queryClient.getQueryData<LatestAgreementsData>(['latest-agreements']);
      queryClient.setQueryData<LatestAgreementsData>(['latest-agreements'], (old) =>
        old
          ? {
              ...old,
              agreements: old.agreements.map((a) =>
                a.id === vars.id ? { ...a, status: vars.done ? 'done' : 'pending' } : a,
              ),
            }
          : old,
      );
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['latest-agreements'], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['latest-agreements'] }),
  });

  const agreements = data.agreements ?? [];
  const pending = agreements.filter((a) => a.status === 'pending');
  const done = agreements.filter((a) => a.status === 'done');

  return (
    <div className="space-y-8">
      <SessionBriefCards
        patientName={data.patient_name}
        lastSession={data.last_session}
        clinicalSummary={data.clinical_summary}
        attentionPoints={data.attention_points}
        activitySuggestions={data.activity_suggestions}
        summaryUpdatedAt={data.summary_updated_at}
      />

      {agreements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 py-12 text-center">
          <p className="text-sm text-charcoal-muted">Nenhum combinado na lista ainda.</p>
          <p className="mt-1 max-w-xs text-xs text-charcoal-muted/70">
            Quando o terapeuta enviar tarefas para casa, elas aparecerão abaixo.
          </p>
        </div>
      ) : (
        <div
          className={`w-full gap-6 ${
            pending.length > 0 && done.length > 0 ? 'lg:grid lg:grid-cols-2 xl:grid-cols-3' : ''
          }`}
        >
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
