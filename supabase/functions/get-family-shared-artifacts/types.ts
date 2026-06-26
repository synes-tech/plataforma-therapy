export type FamilyArtifactType = 'acao_recomendada' | 'resumo_proativo' | 'relatorio_sessao';

export interface GetFamilySharedArtifactsPayload {
  patient_id?: string;
}

export interface FamilySharedArtifactItem {
  id: string;
  tipo_artefato: FamilyArtifactType;
  conteudo_texto: string;
  criado_em: string;
}

export interface GetFamilySharedArtifactsResponse {
  patient_id: string;
  patient_name: string;
  items: FamilySharedArtifactItem[];
}
