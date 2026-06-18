import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';

interface Recommendation {
  title: string;
  description: string;
  category: 'activity' | 'observation' | 'follow_up' | 'alert';
  priority: 'high' | 'medium' | 'low';
}

interface RecommendationsResponse {
  recommendations: Recommendation[];
  summary: string;
  generated_at: string;
  tokens_used: number;
  latency_ms: number;
}

const CATEGORY_CONFIG: Record<Recommendation['category'], { icon: string; label: string; color: string }> = {
  activity: { icon: '🎯', label: 'Atividade', color: 'bg-primary-50 text-primary-700' },
  observation: { icon: '👁️', label: 'Observar', color: 'bg-ai-50 text-ai' },
  follow_up: { icon: '📋', label: 'Acompanhar', color: 'bg-mint-50 text-mint-dark' },
  alert: { icon: '⚠️', label: 'Atenção', color: 'bg-alert-bg text-alert' },
};

const PRIORITY_DOT: Record<Recommendation['priority'], string> = {
  high: 'bg-error',
  medium: 'bg-alert',
  low: 'bg-mint',
};

interface Props {
  patientId: string;
}

export function RecommendationsPanel({ patientId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['session-recommendations', patientId],
    queryFn: () => callFunction<RecommendationsResponse>('get-session-recommendations', { patient_id: patientId }),
    staleTime: 5 * 60 * 1000, // 5 min cache — avoid repeated LLM calls
    retry: 1,
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm">
      {/* Header with AI gradient accent */}
      <div className="border-b border-primary/10 bg-gradient-to-r from-primary-50/50 to-ai-50/30 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-charcoal">Ações Recomendadas para a Próxima Sessão</h2>
            <p className="text-[11px] text-charcoal-muted">Gerado por IA com base no histórico clínico</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {isLoading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-primary">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
              </span>
              Analisando histórico e gerando recomendações...
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-50" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-error/10 bg-error-light/30 px-4 py-3 text-xs text-error">
            Não foi possível gerar recomendações. O copiloto pode estar indisponível.
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
                    key={i}
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
                        <p className="mt-1 text-xs leading-relaxed text-charcoal-muted">
                          {rec.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-[10px] text-charcoal-muted/50">
              ⚠️ Sugestões geradas por IA. Validação profissional obrigatória.
              {' · '}Gerado em {new Date(data.generated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
