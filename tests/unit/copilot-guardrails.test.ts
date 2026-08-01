/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  enforceSafeOutput,
  sanitizeOutput,
  validateOutput,
} from '../../supabase/functions/query-copilot/guardrails.ts';

describe('validateOutput', () => {
  it('bloqueia menção a medicamento', () => {
    expect(validateOutput('Sugiro ritalina para o paciente.').safe).toBe(false);
  });

  it('aceita resposta terapêutica segura', () => {
    expect(
      validateOutput('Com base no diário de 04/06, sugiro atividades de regulação emocional.').safe,
    ).toBe(true);
  });
});

describe('enforceSafeOutput', () => {
  it('sanitiza medicamento sem fallback genérico', () => {
    const result = enforceSafeOutput('Podemos discutir ritalina e metilfenidato com a família.');
    expect(result.sanitized).toBe(true);
    expect(result.usedFallback).toBe(false);
    expect(result.answer.toLowerCase()).not.toContain('ritalina');
    expect(result.answer.toLowerCase()).toContain('acompanhamento medicamentoso');
  });

  it('mantém resposta segura intacta', () => {
    const original = 'Na sessão de 12/05 houve melhora na autorregulação.';
    const result = enforceSafeOutput(original);
    expect(result).toEqual({
      answer: original,
      sanitized: false,
      usedFallback: false,
    });
  });
});

describe('sanitizeOutput', () => {
  it('substitui absolutismos', () => {
    expect(sanitizeOutput('Ele sempre será agressivo.')).toContain('pode apresentar tendência a');
  });
});
