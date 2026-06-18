export interface SessionRecommendation {
  title: string;
  description: string;
  category: 'activity' | 'observation' | 'follow_up' | 'alert';
  priority: 'high' | 'medium' | 'low';
}

export interface SessionRecommendationsResponse {
  recommendations: SessionRecommendation[];
  summary: string;
  generated_at: string;
  tokens_used: number;
  latency_ms: number;
}

export interface SavedRecommendationContent {
  summary: string;
  recommendations: SessionRecommendation[];
  generated_at?: string;
}

export interface SavedRecommendationRecord {
  id: string;
  paciente_id: string;
  terapeuta_id: string;
  conteudo: SavedRecommendationContent;
  criado_em: string;
}

export const CATEGORY_CONFIG: Record<SessionRecommendation['category'], { icon: string; label: string; color: string }> = {
  activity: { icon: '🎯', label: 'Atividade', color: 'bg-primary-50 text-primary-700' },
  observation: { icon: '👁️', label: 'Observar', color: 'bg-ai-50 text-ai' },
  follow_up: { icon: '📋', label: 'Acompanhar', color: 'bg-mint-50 text-mint-dark' },
  alert: { icon: '⚠️', label: 'Atenção', color: 'bg-alert-bg text-alert' },
};

export const PRIORITY_DOT: Record<SessionRecommendation['priority'], string> = {
  high: 'bg-error',
  medium: 'bg-alert',
  low: 'bg-mint',
};
