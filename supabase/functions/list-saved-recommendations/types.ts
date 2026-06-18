export interface ListSavedRecommendationsPayload {
  patient_id: string;
}

export interface SavedRecommendationItem {
  id: string;
  paciente_id: string;
  terapeuta_id: string;
  conteudo: {
    summary: string;
    recommendations: Array<{
      title: string;
      description: string;
      category: string;
      priority: string;
    }>;
    generated_at?: string;
  };
  criado_em: string;
}

export interface ListSavedRecommendationsResponse {
  items: SavedRecommendationItem[];
}
