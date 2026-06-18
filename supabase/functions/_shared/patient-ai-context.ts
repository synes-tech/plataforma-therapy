/**
 * Instruções mestras para IA ingerir campos de anamnese clínica.
 */
export const ANAMNESIS_AI_INSTRUCTIONS = `
CONTEXTO DE ANAMNESE (cadastro do paciente):
Quando disponível, utilize ativamente os campos abaixo para personalizar sugestões:

- hiperfocos_interesses: formule atividades lúdicas altamente engajadoras alinhadas aos interesses do paciente.
- medicamentos: correlacione possíveis alterações de humor, sono ou comportamento relatados no diário com o uso de medicação (sem sugerir alteração de dose ou prescrição).
- queixa_principal e objetivos_terapeuticos: alinhe sugestões de sessão aos objetivos declarados e à queixa inicial.
- composicao_familiar e responsaveis: considere dinâmica familiar ao interpretar relatos do diário.
- acompanhamento_multi: integre o olhar multidisciplinar (ex.: fonoaudiologia, T.O.) nas recomendações.
- informacoes_adicionais: trate como contexto complementar de alto valor quando preenchido.

Se um campo estiver vazio ou nulo, ignore-o sem inventar dados. Pacientes antigos podem não ter anamnese completa — isso é esperado.`;

export interface PatientAnamnesisRow {
  name: string;
  nome_social?: string | null;
  escolaridade_ocupacao?: string | null;
  diagnoses?: unknown;
  queixa_principal?: string | null;
  medicamentos?: string | null;
  acompanhamento_multi?: unknown;
  composicao_familiar?: string | null;
  responsaveis?: string | null;
  objetivos_terapeuticos?: string | null;
  hiperfocos_interesses?: string | null;
  clinical_observations?: string | null;
  informacoes_adicionais?: string | null;
}

function line(label: string, value: string | null | undefined): string {
  const v = value?.trim();
  return `${label}: ${v && v.length > 0 ? v : 'não informado'}`;
}

function formatDiagnoses(diagnoses: unknown): string {
  if (Array.isArray(diagnoses)) return diagnoses.join(', ') || 'não informado';
  return 'não informado';
}

function formatAcompanhamento(value: unknown): string {
  if (Array.isArray(value) && value.length > 0) return value.join(', ');
  return 'nenhum registrado';
}

export function formatAnamnesisBlock(patient: PatientAnamnesisRow): string {
  const lines = [
    '=== ANAMNESE CLÍNICA (cadastro) ===',
    line('Nome', patient.name),
    line('Nome social', patient.nome_social),
    line('Escolaridade/ocupação', patient.escolaridade_ocupacao),
    `Diagnósticos: ${formatDiagnoses(patient.diagnoses)}`,
    line('Queixa principal', patient.queixa_principal),
    line('Medicamentos em uso', patient.medicamentos),
    `Acompanhamento multidisciplinar: ${formatAcompanhamento(patient.acompanhamento_multi)}`,
    line('Composição familiar', patient.composicao_familiar),
    line('Responsáveis', patient.responsaveis),
    line('Objetivos terapêuticos', patient.objetivos_terapeuticos),
    line('Hiperfocos e interesses', patient.hiperfocos_interesses),
    line('Observações clínicas iniciais', patient.clinical_observations),
    line('Informações adicionais', patient.informacoes_adicionais),
  ];
  return lines.join('\n');
}
