export interface DuplicateSavedArtifactPayload {
  patient_id: string;
  artifact_id: string;
}

export interface DuplicateSavedArtifactResponse {
  id: string;
  titulo: string;
  tipo_artefato: string;
  conteudo_texto: string;
  compartilhado_familia: false;
  criado_em: string;
  message: string;
}
