/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { briefingSubtitle } from './dashboard.utils';

describe('briefingSubtitle', () => {
  it('mensagem para zero sessões hoje', () => {
    expect(briefingSubtitle({ sessions_today: 0, sessions_this_week: 0, active_patients_count: 2, alerts_count: 0, crisis_count: 0 })).toContain('Nenhum atendimento');
  });

  it('mensagem plural', () => {
    expect(briefingSubtitle({ sessions_today: 3, sessions_this_week: 5, active_patients_count: 2, alerts_count: 1, crisis_count: 0 })).toContain('3 atendimentos');
  });
});
