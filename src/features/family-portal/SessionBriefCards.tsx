import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';

interface Props {
  patientName: string;
  lastSession: {
    date: string;
    summary_for_family: string;
    plan_highlight: string;
  } | null;
  clinicalSummary: string;
  attentionPoints: string[];
  activitySuggestions: string[];
  summaryUpdatedAt: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function SessionBriefCards({
  patientName,
  lastSession,
  clinicalSummary,
  attentionPoints,
  activitySuggestions,
  summaryUpdatedAt,
}: Props) {
  const firstName = patientName.split(' ')[0] ?? patientName;

  return (
    <div className="mb-8 space-y-4">
      {lastSession && (
        <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-primary-50/30 to-transparent px-5 py-3">
            <h2 className="font-serif text-base font-medium text-charcoal">Resumo da Última Sessão</h2>
            <p className="text-xs text-charcoal-muted">{formatDate(lastSession.date)}</p>
          </div>
          <div className="space-y-3 px-5 py-4">
            <AiMarkdownContent content={lastSession.summary_for_family} variant="light" />
            {lastSession.plan_highlight && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal-muted/70">
                  Combinado da sessão
                </p>
                <div className="mt-1">
                  <AiMarkdownContent content={lastSession.plan_highlight} variant="light" />
                </div>
              </div>
            )}
          </div>
        </article>
      )}

      {(clinicalSummary || attentionPoints.length > 0 || activitySuggestions.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {clinicalSummary && (
            <article className="rounded-2xl border border-slate-200/60 bg-white/85 p-5 shadow-sm backdrop-blur-sm lg:col-span-2 xl:col-span-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">Visão geral</h3>
              <div className="mt-2">
                <AiMarkdownContent content={clinicalSummary} variant="light" />
              </div>
              {summaryUpdatedAt && (
                <p className="mt-3 text-[10px] text-charcoal-muted/60">
                  Atualizado em {formatDate(summaryUpdatedAt)}
                </p>
              )}
            </article>
          )}

          {attentionPoints.length > 0 && (
            <article className="rounded-2xl border border-amber-200/50 bg-amber-50/40 p-5 shadow-sm backdrop-blur-sm">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                <span aria-hidden>⚠️</span> Pontos de Atenção
              </h3>
              <ul className="mt-3 space-y-2">
                {attentionPoints.map((point, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-amber-950/90">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          )}

          {activitySuggestions.length > 0 && (
            <article className="rounded-2xl border border-primary/20 bg-primary-50/30 p-5 shadow-sm backdrop-blur-sm">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary-700">
                <span aria-hidden>🎯</span> Para praticar em casa
              </h3>
              <p className="mt-1 text-xs text-charcoal-muted">
                Sugestões do terapeuta para {firstName}
              </p>
              <ul className="mt-3 space-y-2">
                {activitySuggestions.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-charcoal">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          )}
        </div>
      )}

      {!lastSession && !clinicalSummary && attentionPoints.length === 0 && activitySuggestions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-5 py-8 text-center">
          <p className="text-sm text-charcoal-muted">
            Quando o terapeuta registrar a próxima sessão, o resumo aparecerá aqui para você acompanhar.
          </p>
        </div>
      )}
    </div>
  );
}
