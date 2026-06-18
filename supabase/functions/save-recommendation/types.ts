export interface SaveRecommendationPayload {
  patient_id: string;
  conteudo: {
    summary: string;
    recommendations: Array<{
      title: string;
      description: string;
      category: 'activity' | 'observation' | 'follow_up' | 'alert';
      priority: 'high' | 'medium' | 'low';
    }>;
    generated_at?: string;
  };
}

export interface SaveRecommendationResponse {
  id: string;
  criado_em: string;
  message: string;
}
