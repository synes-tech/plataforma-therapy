/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  hasAnyContextFlag,
  countActiveFlags,
  EMPTY_CONTEXT_FLAGS,
} from './session-recommendations.context';

describe('recomendações — context flags', () => {
  it('rejeita payload sem nenhuma fonte ativa', () => {
    expect(hasAnyContextFlag(EMPTY_CONTEXT_FLAGS)).toBe(false);
  });

  it('aceita uma única fonte', () => {
    const flags = { ...EMPTY_CONTEXT_FLAGS, use_profile: true };
    expect(hasAnyContextFlag(flags)).toBe(true);
    expect(countActiveFlags(flags)).toBe(1);
  });

  it('aceita combinação de três fontes', () => {
    const flags = {
      use_profile: true,
      use_family_diary: true,
      use_last_session: false,
      use_history: true,
    };
    expect(countActiveFlags(flags)).toBe(3);
  });

  it('aceita todas as fontes ativas', () => {
    const flags = {
      use_profile: true,
      use_family_diary: true,
      use_last_session: true,
      use_history: true,
    };
    expect(countActiveFlags(flags)).toBe(4);
  });

  it('monta payload com flags para o backend', () => {
    const payload = {
      patient_id: 'uuid-patient',
      context: {
        use_profile: true,
        use_family_diary: true,
        use_last_session: false,
        use_history: false,
      },
    };
    expect(payload.context.use_profile).toBe(true);
    expect(hasAnyContextFlag(payload.context)).toBe(true);
  });
});

describe('recomendações — regenerate payload', () => {
  it('inclui contexto da versão anterior para alternativas', () => {
    const payload = {
      patient_id: 'uuid-patient',
      context: { use_profile: true, use_family_diary: false, use_last_session: true, use_history: false },
      regenerate: true,
      previous_summary: 'Foco em regulação emocional',
      previous_recommendations: [
        {
          title: 'Atividade sensorial',
          description: 'Usar massinha',
          category: 'activity' as const,
          priority: 'medium' as const,
        },
      ],
    };
    expect(payload.regenerate).toBe(true);
    expect(payload.previous_recommendations).toHaveLength(1);
  });
});
