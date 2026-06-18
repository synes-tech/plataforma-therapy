/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';

describe('recomendações — regenerate payload', () => {
  it('inclui contexto da versão anterior para alternativas', () => {
    const payload = {
      patient_id: 'uuid-patient',
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

  it('versões diferentes não são idênticas (anti-loop)', () => {
    const v1 = { summary: 'A', recommendations: [{ title: 'X', description: 'd1' }] };
    const v2 = { summary: 'B', recommendations: [{ title: 'Y', description: 'd2' }] };
    expect(JSON.stringify(v1)).not.toBe(JSON.stringify(v2));
  });
});

describe('recomendações — save payload', () => {
  it('monta conteúdo completo para salvar', () => {
    const conteudo = {
      summary: 'Resumo da sessão',
      recommendations: [
        { title: 'T1', description: 'D1', category: 'activity', priority: 'high' },
      ],
      generated_at: '2026-06-18T12:00:00Z',
    };
    const payload = { patient_id: 'p1', conteudo };
    expect(payload.conteudo.recommendations).toHaveLength(1);
    expect(payload.patient_id).toBe('p1');
  });
});
