import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { canGenerateSummary } from './canGenerateSummary';
import { ExecutiveMarkdown } from './ExecutiveMarkdown';

interface SummaryResponse {
  summary_markdown: string;
  generated_at: string;
  tokens_used: number;
  latency_ms: number;
  answer_incomplete?: boolean;
  scope: { sessions_included: number; total_sessions: number };
}

interface Props {
  patientId: string;
  totalSessions: number;
  hasClinicalObservations: boolean;
}

export function ExecutiveSummaryPanel({ patientId, totalSessions, hasClinicalObservations }: Props) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const eligible = canGenerateSummary(totalSessions, hasClinicalObservations);

  const mutation = useMutation({
    mutationFn: () => callFunction<SummaryResponse>('generate-patient-summary', { patient_id: patientId }),
    onSuccess: (data) => setSummary(data),
  });

  function handleGenerate() {
    if (!eligible || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800/60 shadow-xl">
      {/* Dark glass header */}
      <div className="relative border-b border-white/5 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] px-5 py-4 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.15),transparent_60%)]" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-ai/30 bg-ai/10 shadow-[0_0_20px_rgba(124,58,237,0.25)]">
              <svg className="h-4 w-4 text-ai-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-serif text-base font-medium text-white">Resumo Executivo</h2>
              <p className="text-[11px] text-slate-400">
                Briefing clínico gerado por IA antes da consulta
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!eligible || mutation.isPending}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/20 px-4 text-xs font-medium text-primary-light shadow-[0_0_16px_rgba(26,134,226,0.2)] transition-all hover:border-primary/60 hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mutation.isPending ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-light border-t-transparent" />
                Gerando briefing...
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Gerar Resumo Executivo
              </>
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="relative bg-[#0B1120]/95 px-5 py-5 backdrop-blur-md">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(26,134,226,0.08),transparent_50%)]" />

        <div className="relative">
          {!eligible && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90">
              Este paciente ainda não possui sessões registradas nem observações clínicas.
              Cadastre a primeira evolução ou grave uma sessão para habilitar o resumo executivo.
            </div>
          )}

          {eligible && !summary && !mutation.isPending && !mutation.isError && (
            <p className="text-xs text-slate-500">
              Clique em &quot;Gerar Resumo Executivo&quot; para obter alertas críticos, evolução recente e foco sugerido para a sessão de hoje.
              {totalSessions > 10 && (
                <span className="mt-1 block text-slate-600">
                  Escopo: últimas 10 de {totalSessions} sessões + perfil inicial.
                </span>
              )}
            </p>
          )}

          {mutation.isPending && (
            <div className="space-y-4" aria-busy="true" aria-label="Gerando resumo executivo">
              <div className="flex items-center gap-2 text-xs text-primary-light">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-light shadow-[0_0_8px_rgba(77,163,237,0.9)]" />
                </span>
                Analisando prontuário e consolidando briefing clínico...
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {mutation.isError && (
            <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-xs text-red-300">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Não foi possível gerar o resumo. Tente novamente.'}
            </div>
          )}

          {summary && !mutation.isPending && (
            <>
              {summary.answer_incomplete && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                  O resumo pode estar incompleto. Gere novamente se necessário.
                </div>
              )}
              <ExecutiveMarkdown content={summary.summary_markdown} />
              <p className="mt-5 border-t border-white/5 pt-3 text-[10px] text-slate-600">
                IA · {summary.scope.sessions_included} sessões analisadas de {summary.scope.total_sessions} no prontuário
                {' · '}
                {new Date(summary.generated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
