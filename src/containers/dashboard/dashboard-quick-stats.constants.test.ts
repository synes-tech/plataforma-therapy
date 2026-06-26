/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { DASHBOARD_QUICK_STATS } from './dashboard-quick-stats.constants';

describe('DASHBOARD_QUICK_STATS', () => {
  it('vincula pacientes ativos à listagem', () => {
    const patients = DASHBOARD_QUICK_STATS.find((stat) => stat.id === 'active_patients');
    expect(patients?.action).toEqual({
      type: 'link',
      to: '/patients',
      ariaLabel: 'Ver listagem de pacientes ativos',
    });
  });

  it('expõe ação configurável para os demais cards', () => {
    const sessions = DASHBOARD_QUICK_STATS.find((stat) => stat.id === 'sessions_week');
    const alerts = DASHBOARD_QUICK_STATS.find((stat) => stat.id === 'pending_alerts');

    expect(sessions?.action?.type).toBe('link');
    expect(alerts?.action?.type).toBe('scroll');
  });
});
