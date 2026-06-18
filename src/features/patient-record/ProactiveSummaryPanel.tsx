import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { canGenerateSummary } from './canGenerateSummary';
import { ExecutiveMarkdown } from './ExecutiveMarkdown';

interface ProactiveSummaryResponse {
  summary_markdown: string;
  generated_at: string;
  updated_at: string;
  from_cache: boolean;
  tokens_used: number;
  latency_ms: number;
  answer_incomplete?: boolean;
  diary_entries_count: number;
}

interface Props {
  patientId: string;
  totalSessions: number;
  hasClinicalObservations: boolean;
}

export function ProactiveSummaryPanel({ patientId, totalSessions, hasClinicalObservations }: Props) {
  const eligible = canGenerateSummary(totalSessions, hasClinicalObservations);
  const [summary, setSummary] = useState<ProactiveSummaryResponse | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      callFunction<ProactiveSummaryResponse>('generate-proactive-summary', {
        patient_id: patientId,
      }),
    onSuccess: (data) => setSummary(data),
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      callFunction<ProactiveSummaryResponse>('generate-proactive-summary', {
        patient_id: patientId,
        force: true,
      }),
    onSuccess: (data) => setSummary(data),
  });

  const isGenerating = mutation.isPending || refreshMutation.isPending;
  const activeError = mutation.error ?? refreshMutation.error;

  function handleGenerate() {
    if (!eligible || isGenerating) return;
    mutation.mutate();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-lg">
      <div className="relative border-b border-slate-700/60 px-4 py-4 lg:px-6 lg:py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.12),transparent_60%)]" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-ai/30 bg-ai/10 shadow-[0_0_20px_rgba(124,58,237,0.25)]">
              <svg className="h-4 w-4 text-ai-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-serif text-base font-medium text-white">Resumo Clínico Proativo</h2>
              <p className="text-[11px] text-slate-400">
                Gerado com base no diário da família e histórico recente
              </p>
            </div>
          </div>

          {eligible && (
            <div className="flex flex-wrap items-center gap-2">
              {summary && (
                <button
                  type="button"
                  onClick={() => refreshMutation.mutate()}
                  disabled={isGenerating}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[11px] text-slate-400 transition-colors hover:border-primary/40 hover:text-primary-light disabled:opacity-40"
                >
                  Atualizar
                </button>
              )}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!eligible || isGenerating}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/20 px-4 text-xs font-medium text-primary-light shadow-[0_0_16px_rgba(26,134,226,0.2)] transition-all hover:border-primary/60 hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGenerating ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-light border-t-transparent" />
                    Gerando...
                  </>
                ) : (
                  summary ? 'Regenerar resumo' : 'Gerar resumo proativo'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative px-4 py-5 lg:px-6 lg:py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(26,134,226,0.06),transparent_50%)]" />
        <div className="relative">
          {!eligible && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90">
              Aguardando o primeiro registro clínico ou entrada no diário familiar para gerar o resumo proativo.
            </div>
          )}

          {eligible && !summary && !isGenerating && !activeError && (
            <p className="text-xs text-slate-500">
              Clique em &quot;Gerar resumo proativo&quot; para consolidar o diário semanal da família e sugestões
              de atividades antes da consulta.
            </p>
          )}

          {isGenerating && (
            <div className="space-y-4" aria-busy="true" aria-label="Gerando resumo clínico proativo">
              <div className="flex items-center gap-2 text-xs text-primary-light">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-light shadow-[0_0_8px_rgba(77,163,237,0.9)]" />
                </span>
                Consolidando diário semanal e histórico clínico...
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
                  />
                ))}
              </div>
            </div>
          )}

          {activeError && !isGenerating && (
            <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-xs text-red-300">
              {activeError instanceof Error
                ? activeError.message
                : 'Não foi possível gerar o resumo proativo.'}
              <button
                type="button"
                onClick={handleGenerate}
                className="mt-3 block rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:bg-white/5"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {summary && !isGenerating && (
            <>
              {summary.answer_incomplete && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                  O resumo pode estar incompleto. Use &quot;Atualizar&quot; para regenerar.
                </div>
              )}
              <ExecutiveMarkdown content={summary.summary_markdown} />
              <p className="mt-5 border-t border-white/5 pt-3 text-[10px] text-slate-600">
                {summary.from_cache ? 'Cache · ' : 'Novo · '}
                {summary.diary_entries_count} registros do diário (7 dias)
                {' · '}
                {new Date(summary.updated_at).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' · '}
                Validação profissional obrigatória.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
