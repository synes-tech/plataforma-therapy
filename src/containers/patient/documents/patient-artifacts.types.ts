import type { AiArtifactType } from '../copilot/patient-copilot.types';

export type ArtifactFilterValue = 'todos' | AiArtifactType;

export interface PatientArtifact {
  id: string;
  tipo_artefato: AiArtifactType;
  conteudo_texto: string;
  criado_em: string;
  is_legacy: boolean;
}

export interface PatientArtifactsResponse {
  items: PatientArtifact[];
}
