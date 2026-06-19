export interface ListAiArtifactStatusPayload {
  patient_id: string;
}

export interface SavedArtifactKey {
  artifact_fingerprint: string;
  tipo_artefato: string;
}

export interface ListAiArtifactStatusResponse {
  saved: SavedArtifactKey[];
}
