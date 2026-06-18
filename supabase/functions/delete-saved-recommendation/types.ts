export interface DeleteSavedRecommendationPayload {
  patient_id: string;
  recommendation_id: string;
}

export interface DeleteSavedRecommendationResponse {
  id: string;
  message: string;
}
