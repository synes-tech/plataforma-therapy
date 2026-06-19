import { Spinner } from '@containers/loading';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { usePaywall } from '@containers/paywall';
import { Toast } from './Toast';
import { RecordEmptyState } from './RecordEmptyState';
import { RecommendationsContextModal } from './RecommendationsContextModal';
import {
  CATEGORY_CONFIG,
  PRIORITY_DOT,
  type SessionRecommendationsResponse,
} from './session-recommendations.types';
import {
  EMPTY_CONTEXT_FLAGS,
  type RecommendationContextFlags,
} from './session-recommendations.context';

interface Props {
  patientId: string;
}

type GeneratePayload = {
  context: RecommendationContextFlags;
  regenerate?: boolean;
  previous?: SessionRecommendationsResponse;
};

export function SessionRecommendationsPanel({ patientId }: Props) {
  const queryClient = useQueryClient();
  const { interceptAiFeature, handlePaymentRequired } = usePaywall();
  const [data, setData] = useState<SessionRecommendationsResponse | null>(null);
  const [lastContext, setLastContext] = useState<RecommendationContextFlags>(EMPTY_CONTEXT_FLAGS);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'generate' | 'regenerate'>('generate');
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const generateMutation = useMutation({
    mutationFn: async ({ context, regenerate, previous }: GeneratePayload) => {
      return callFunction<SessionRecommendationsResponse>('get-session-recommendations', {
        patient_id: patientId,
        context,
        regenerate: regenerate ?? false,
        ...(regenerate && previous
          ? {
              previous_summary: previous.summary,
              previous_recommendations: previous.recommendations,
            }
          : {}),
      });
    },
    onSuccess: (fresh, variables) => {
      setData(fresh);
      setLastContext(variables.context);
      setModalOpen(false);
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === 'PAYMENT_REQUIRED') {
        handlePaymentRequired();
        setModalOpen(false);
        return;
      }
      setToast({
        message: err.message || 'Não foi possível gerar recomendações',
        variant: 'error',
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: SessionRecommendationsResponse) => {
      return callFunction('save-recommendation', {
        patient_id: patientId,
        conteudo: {
          summary: payload.summary,
          recommendations: payload.recommendations,
          generated_at: payload.generated_at,
        },
      });
    },
    onSuccess: () => {
      setToast({ message: 'Recomendação salva com sucesso', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['saved-recommendations', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-artifacts', patientId] });
    },
    onError: (err: Error) => {
      setToast({ message: err.message || 'Falha ao salvar', variant: 'error' });
    },
  });

  const isGenerating = generateMutation.isPending;
  const canAct = !!data && !isGenerating && !saveMutation.isPending;

  function openGenerateModal() {
    interceptAiFeature(() => {
      setModalMode('generate');
      setModalOpen(true);
    });
  }

  function openRegenerateModal() {
    interceptAiFeature(() => {
      setModalMode('regenerate');
      setModalOpen(true);
    });
  }

  function handleModalConfirm(flags: RecommendationContextFlags) {
    if (modalMode === 'regenerate' && data) {
      generateMutation.mutate({ context: flags, regenerate: true, previous: data });
    } else {
      generateMutation.mutate({ context: flags });
    }
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm">
        {isGenerating && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/80 backdrop-blur-sm">
            <div className="relative h-14 w-14">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/5">
                <Spinner size="md" />
              </span>
            </div>
            <p className="text-sm font-medium text-primary">Analisando contexto selecionado...</p>
            <p className="text-xs text-charcoal-muted">A IA está montando as ações para a próxima sessão</p>
          </div>
        )}

        <div className="border-b border-primary/10 bg-gradient-to-r from-primary-50/50 to-ai-50/30 px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-charcoal">Ações Recomendadas para a Próxima Sessão</h2>
                <p className="text-[11px] text-charcoal-muted">
                  {data ? 'Gerado sob demanda com as fontes que você escolher' : 'Aguardando sua solicitação'}
                </p>
              </div>
            </div>

            {data && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canAct}
                  onClick={openRegenerateModal}
                  title="Gerar nova versão"
                  className="inline-flex h-11 min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-charcoal-muted transition-all hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Nova versão
                </button>
                <button
                  type="button"
                  disabled={!canAct}
                  onClick={() => saveMutation.mutate(data)}
                  title="Salvar recomendação"
                  className="inline-flex h-11 min-h-[44px] items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-50 px-3 text-xs font-medium text-primary transition-all hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  )}
                  Salvar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 lg:p-6">
          {!data && !isGenerating && (
            <RecordEmptyState
              variant="recommendations"
              action={
                <button
                  type="button"
                  onClick={openGenerateModal}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Gerar Ações Recomendadas
                </button>
              }
            />
          )}

          {generateMutation.isError && !data && (
            <div className="rounded-xl border border-error/10 bg-error-light/30 px-4 py-3 text-xs text-error">
              Não foi possível gerar recomendações. Tente novamente com outras fontes.
            </div>
          )}

          {data && (
            <>
              {data.summary && (
                <p className="mb-4 text-sm leading-relaxed text-charcoal-muted">{data.summary}</p>
              )}

              <div className="space-y-3">
                {data.recommendations.map((rec, i) => {
                  const config = CATEGORY_CONFIG[rec.category] ?? CATEGORY_CONFIG.observation;
                  return (
                    <div
                      key={`${rec.title}-${i}`}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-base">{config.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-charcoal">{rec.title}</h4>
                            <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[rec.priority]}`} />
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-charcoal-muted">{rec.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-4 text-[10px] text-charcoal-muted/50">
                Sugestões geradas por IA. Validação profissional obrigatória.
                {' · '}Gerado em{' '}
                {new Date(data.generated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          )}
        </div>
      </div>

      <RecommendationsContextModal
        isOpen={modalOpen}
        onClose={() => !isGenerating && setModalOpen(false)}
        onConfirm={handleModalConfirm}
        isSubmitting={isGenerating}
        initialFlags={modalMode === 'regenerate' ? lastContext : EMPTY_CONTEXT_FLAGS}
      />

      <Toast
        message={toast?.message ?? ''}
        visible={!!toast}
        variant={toast?.variant}
        onDismiss={() => setToast(null)}
      />
    </>
  );
}
