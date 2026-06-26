import { vertexJSON } from './vertex.ts';

export const FAMILY_DIARY_CATEGORIES = [
  'sono',
  'escola',
  'alimentacao',
  'social',
  'hiperatividade',
  'sensorial',
] as const;

export type FamilyDiaryCategory = (typeof FAMILY_DIARY_CATEGORIES)[number];

export interface FamilyDiaryCheckinExtract {
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level: number | null;
  categories: FamilyDiaryCategory[];
  notes: string;
}

const EXTRACT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    mood_score: { type: 'INTEGER' },
    sleep_quality: { type: 'INTEGER' },
    crisis_occurred: { type: 'BOOLEAN' },
    crisis_level: { type: 'INTEGER', nullable: true },
    categories: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    notes: { type: 'STRING' },
  },
  required: ['mood_score', 'sleep_quality', 'crisis_occurred', 'categories', 'notes'],
  propertyOrdering: [
    'mood_score',
    'sleep_quality',
    'crisis_occurred',
    'crisis_level',
    'categories',
    'notes',
  ],
};

const EXTRACT_PROMPT = `Você analisa a transcrição de um relato em áudio feito por um responsável sobre o dia/momento de uma criança em acompanhamento terapêutico (TEA/TDAH).

Extraia APENAS o que está explícito ou claramente inferível no texto. Não invente fatos.

Regras:
- mood_score (1-5): 1=muito difícil/negativo, 3=neutro, 5=muito positivo.
- sleep_quality (1-5): qualidade do sono mencionada; se NÃO houver menção ao sono, use 3 (regular).
- crisis_occurred: true SOMENTE se houver crise, birra intensa, meltdown, agressividade grave, crise sensorial ou episódio claramente descrito como crise.
- crisis_level (1-5 ou null): intensidade da crise se crisis_occurred=true; null se não houve crise.
- categories: lista com zero ou mais valores EXATOS: sono, escola, alimentacao, social, hiperatividade, sensorial — conforme temas citados.
- notes: resumo objetivo em português (máx. 900 caracteres) do relato para o terapeuta.

Responda APENAS no JSON do schema.`;

function clampScore(value: unknown, fallback = 3): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function normalizeFamilyDiaryCheckinExtract(raw: {
  mood_score: unknown;
  sleep_quality: unknown;
  crisis_occurred: unknown;
  crisis_level?: unknown;
  categories?: unknown;
  notes?: unknown;
}): FamilyDiaryCheckinExtract {
  const crisisOccurred = raw.crisis_occurred === true;
  let crisisLevel: number | null = crisisOccurred ? clampScore(raw.crisis_level, 3) : null;

  const categoriesRaw = Array.isArray(raw.categories) ? raw.categories : [];
  const categories = categoriesRaw
    .filter((c): c is string => typeof c === 'string')
    .map((c) => c.trim().toLowerCase())
    .filter((c): c is FamilyDiaryCategory =>
      (FAMILY_DIARY_CATEGORIES as readonly string[]).includes(c),
    );

  const uniqueCategories = [...new Set(categories)];

  const notes = typeof raw.notes === 'string'
    ? raw.notes.trim().slice(0, 1000)
    : '';

  return {
    mood_score: clampScore(raw.mood_score, 3),
    sleep_quality: clampScore(raw.sleep_quality, 3),
    crisis_occurred: crisisOccurred,
    crisis_level: crisisLevel,
    categories: uniqueCategories,
    notes,
  };
}

export async function extractFamilyDiaryCheckinFromTranscript(
  transcricao: string,
): Promise<{ extracted: FamilyDiaryCheckinExtract; tokens: number }> {
  const trimmed = transcricao.trim();
  if (!trimmed) {
    throw new Error('Transcrição vazia');
  }

  const { data, tokens } = await vertexJSON<{
    mood_score: number;
    sleep_quality: number;
    crisis_occurred: boolean;
    crisis_level?: number | null;
    categories?: string[];
    notes?: string;
  }>(
    [{ text: `${EXTRACT_PROMPT}\n\n--- TRANSCRIÇÃO ---\n${trimmed}` }],
    {
      temperature: 0.1,
      maxOutputTokens: 1024,
      responseSchema: EXTRACT_SCHEMA,
    },
  );

  return {
    extracted: normalizeFamilyDiaryCheckinExtract(data),
    tokens,
  };
}
