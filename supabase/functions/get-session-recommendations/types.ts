export interface RecommendationContextFlags {
  use_profile: boolean;
  use_family_diary: boolean;
  use_last_session: boolean;
  use_history: boolean;
}

export interface RecommendationsPayload {
  patient_id: string;
  context: RecommendationContextFlags;
  regenerate?: boolean;
  previous_summary?: string;
  previous_recommendations?: Recommendation[];
}

export interface Recommendation {
  title: string;
  description: string;
  category: 'activity' | 'observation' | 'follow_up' | 'alert';
  priority: 'high' | 'medium' | 'low';
  source_context?: string;
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
  summary: string;
  generated_at: string;
  tokens_used: number;
  latency_ms: number;
}
