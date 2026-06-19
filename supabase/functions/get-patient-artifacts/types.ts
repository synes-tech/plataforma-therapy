export type ArtifactFilterType =
  | 'todos'
  | 'acao_recomendada'
  | 'resumo_proativo'
  | 'relatorio_sessao';

export type ArtifactType = 'acao_recomendada' | 'resumo_proativo' | 'relatorio_sessao';

export interface GetPatientArtifactsPayload {
  patient_id: string;
  filtro_tipo?: ArtifactFilterType;
}

export interface PatientArtifactItem {
  id: string;
  tipo_artefato: ArtifactType;
  conteudo_texto: string;
  criado_em: string;
  is_legacy: boolean;
}

export interface GetPatientArtifactsResponse {
  items: PatientArtifactItem[];
}
