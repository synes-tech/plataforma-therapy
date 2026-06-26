export interface UpdateArtifactVisibilityPayload {
  artifact_id: string;
  compartilhado_familia: boolean;
}

export interface UpdateArtifactVisibilityResponse {
  id: string;
  compartilhado_familia: boolean;
  message: string;
}
