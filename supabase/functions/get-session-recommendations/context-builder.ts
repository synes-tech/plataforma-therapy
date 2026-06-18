import { formatAnamnesisBlock, type PatientAnamnesisRow } from '../_shared/patient-ai-context.ts';

/** Limite interno de custo — nunca expor na UI. */
export const SESSION_HISTORY_MAX = 5;
const DIARY_WEEK_DAYS = 7;

export interface RecommendationContextFlags {
  use_profile: boolean;
  use_family_diary: boolean;
  use_last_session: boolean;
  use_history: boolean;
}

export interface BuiltRecommendationContext {
  blocks: string[];
  activeSources: string[];
  isEmpty: boolean;
}

function formatSoapNote(content: Record<string, string>, date: string, status: string, label: string): string {
  return `[${label} | ${date.split('T')[0]} | ${status}]
Subjetivo: ${content.subjective ?? 'N/A'}
Objetivo: ${content.objective ?? 'N/A'}
Avaliação: ${content.assessment ?? 'N/A'}
Plano: ${content.plan ?? 'N/A'}`;
}

export function buildContextFromData(
  flags: RecommendationContextFlags,
  data: {
    patient: PatientAnamnesisRow;
    diary: Array<{
      entry_date: string;
      mood_score: number;
      sleep_quality: number;
      crisis_occurred: boolean;
      crisis_level: number | null;
      notes: string | null;
    }>;
    sessions: Array<{ content: Record<string, string>; status: string; created_at: string }>;
  },
): BuiltRecommendationContext {
  const blocks: string[] = [];
  const activeSources: string[] = [];

  if (flags.use_profile) {
    activeSources.push('ficha_clinica');
    blocks.push(formatAnamnesisBlock(data.patient));
  }

  if (flags.use_family_diary) {
    activeSources.push('diario_familiar');
    const diaryLines = data.diary.map(
      (d) =>
        `Data: ${d.entry_date} | Humor: ${d.mood_score}/5 | Sono: ${d.sleep_quality}/5${
          d.crisis_occurred ? ` | CRISE nível ${d.crisis_level}` : ''
        }${d.notes ? ` | Obs: ${d.notes}` : ''}`,
    );
    blocks.push(
      `=== DIÁRIO FAMILIAR (últimos ${DIARY_WEEK_DAYS} dias) ===\n${
        diaryLines.length > 0 ? diaryLines.join('\n') : 'Nenhuma entrada no período.'
      }`,
    );
  }

  const sessions = data.sessions;

  if (flags.use_last_session && sessions.length > 0) {
    activeSources.push('ultima_sessao');
    const last = sessions[0];
    blocks.push(
      `=== ÚLTIMA SESSÃO REALIZADA ===\n${formatSoapNote(last.content, last.created_at, last.status, 'Sessão mais recente')}`,
    );
  }

  if (flags.use_history) {
    activeSources.push('historico_sessoes');
    const historySessions =
      flags.use_last_session && sessions.length > 1 ? sessions.slice(1) : sessions;

    const historyBlock = historySessions
      .map((n, i) =>
        formatSoapNote(n.content, n.created_at, n.status, `Sessão ${i + 1}`)
      )
      .join('\n\n');

    blocks.push(
      `=== HISTÓRICO RECENTE DE SESSÕES ===\n${
        historyBlock || 'Nenhuma sessão anterior registrada.'
      }`,
    );
  }

  return {
    blocks,
    activeSources,
    isEmpty: blocks.every((b) => b.includes('Nenhum') || b.includes('não informado')),
  };
}

export function sessionFetchLimit(flags: RecommendationContextFlags): number {
  if (flags.use_history) return SESSION_HISTORY_MAX;
  if (flags.use_last_session) return 1;
  return 0;
}

export function needsSessions(flags: RecommendationContextFlags): boolean {
  return flags.use_last_session || flags.use_history;
}

export function needsDiary(flags: RecommendationContextFlags): boolean {
  return flags.use_family_diary;
}

export { DIARY_WEEK_DAYS };
