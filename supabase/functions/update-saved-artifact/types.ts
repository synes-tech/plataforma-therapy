export interface UpdateSavedArtifactPayload {
  patient_id: string;
  artifact_id: string;
  titulo?: string | null;
  conteudo_texto: string;
}

export interface UpdateSavedArtifactResponse {
  id: string;
  titulo: string | null;
  conteudo_texto: string;
  artifact_fingerprint: string | null;
  message: string;
}
