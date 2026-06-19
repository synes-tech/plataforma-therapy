export const PATIENT_COPILOT_QUICK_PROMPTS = [
  'Resuma as últimas 3 sessões',
  'Há padrões de crise?',
  'Sugira atividades para hoje',
  'Combinados para regulação emocional',
] as const;

export const COPILOT_DISCLAIMER =
  'O copiloto auxilia o planejamento, mas não substitui a validação clínica.';

export const DOC_TYPE_LABELS: Record<string, string> = {
  session_note: 'Evolução',
  diary_entry: 'Diário',
  patient_profile: 'Perfil',
};
