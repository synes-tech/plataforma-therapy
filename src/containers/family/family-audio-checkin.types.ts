export interface FamilyAudioCheckinDraft {
  entryDate: string;
  transcricao: string;
  audioUrl: string;
  durationSeconds?: number;
}

export interface FamilyAudioCheckinExtracted {
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level: number | null;
  categories: string[];
  notes: string;
}

export interface FamilyAudioCheckinSubmitResponse {
  diary_entry_id: string;
  message: string;
  extracted: FamilyAudioCheckinExtracted;
}

export const FAMILY_CATEGORY_LABELS: Record<string, string> = {
  sono: 'Sono',
  escola: 'Escola',
  alimentacao: 'Alimentação',
  social: 'Social',
  hiperatividade: 'Agitação',
  sensorial: 'Sensorial',
};

export const FAMILY_MOOD_LABELS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😢', label: 'Difícil' },
  2: { emoji: '😟', label: 'Abaixo' },
  3: { emoji: '😐', label: 'Neutro' },
  4: { emoji: '🙂', label: 'Bom' },
  5: { emoji: '😄', label: 'Ótimo' },
};

export const FAMILY_SLEEP_LABELS: Record<number, string> = {
  1: 'Péssimo',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Ótimo',
};
