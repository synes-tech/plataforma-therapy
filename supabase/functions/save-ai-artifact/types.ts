export type AiArtifactType = 'acao_recomendada' | 'resumo_proativo' | 'relatorio_sessao';

export interface SaveAiArtifactPayload {
  patient_id: string;
  conteudo_texto: string;
  tipo_artefato: AiArtifactType;
}

export interface SaveAiArtifactResponse {
  id: string;
  criado_em: string;
  artifact_fingerprint: string;
  tipo_artefato: AiArtifactType;
  already_saved: boolean;
  message: string;
}
