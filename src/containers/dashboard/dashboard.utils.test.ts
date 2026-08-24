/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { briefingSubtitle } from './dashboard.utils';
import { withSummaryDefaults } from './home.utils';

describe('briefingSubtitle', () => {
  it('mensagem para zero sessões hoje', () => {
    expect(briefingSubtitle(withSummaryDefaults({ active_patients_count: 2 }))).toContain('Nenhum atendimento');
  });

  it('mensagem plural', () => {
    expect(briefingSubtitle(withSummaryDefaults({ sessions_today: 3, sessions_this_week: 5, alerts_count: 1 }))).toContain('3 atendimentos');
  });
});
