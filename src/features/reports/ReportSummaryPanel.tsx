import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import DOMPurify from 'dompurify';
import type { ReportItem } from './AllReportsTab';

interface SummaryResponse {
  session_note_id: string;
  summary_bullets: string[];
  generated_at: string;
}

interface ReportSummaryPanelProps {
  report: ReportItem;
  onClose: () => void;
}

export function ReportSummaryPanel({ report }: ReportSummaryPanelProps) {
  const summaryMutation = useMutation({
    mutationFn: () =>
      callFunction<SummaryResponse>('generate-report-summary', {
        session_note_id: report.id,
      }),
  });

  // Auto-trigger on mount
  useEffect(() => {
    summaryMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[12rem]">
      {/* Loading */}
      {summaryMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-ai border-t-transparent" />
          <p className="bg-ai-gradient bg-clip-text text-sm font-medium text-transparent">
            Gerando resumo com IA...
          </p>
          <p className="mt-1 text-xs text-charcoal-muted">Analisando a evolução clínica.</p>
        </div>
      )}

      {/* Error */}
      {summaryMutation.isError && (
        <div className="flex flex-col items-center py-8 text-center">
          <div role="alert" className="mb-4 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
            {summaryMutation.error.message}
          </div>
          <button
            onClick={() => summaryMutation.mutate()}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-charcoal transition-colors hover:bg-slate-50"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Success */}
      {summaryMutation.isSuccess && summaryMutation.data && (
        <div className="animate-fade-in">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ai-50">
              <svg className="h-3.5 w-3.5 text-ai" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-charcoal">Insights Clínicos</h3>
          </div>

          <ul className="space-y-2.5">
            {summaryMutation.data.summary_bullets.map((bullet, idx) => (
              <li key={idx} className="flex gap-3 rounded-xl bg-slate-50/80 px-4 py-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ai/10 text-[10px] font-bold text-ai">
                  {idx + 1}
                </span>
                <p
                  className="text-sm leading-relaxed text-charcoal"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bullet) }}
                />
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[10px] text-charcoal-muted/60">
            Gerado em {new Date(summaryMutation.data.generated_at).toLocaleString('pt-BR')}
          </p>
        </div>
      )}
    </div>
  );
}
