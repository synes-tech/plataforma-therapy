import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardHeaderTools } from './DashboardHeaderTools';
import type { DashboardNotificationItem } from './dashboard-notifications.types';

function item(partial: Partial<DashboardNotificationItem> = {}): DashboardNotificationItem {
  return {
    id: 'clinical-a1',
    group: 'alerts',
    kind: 'clinical',
    title: 'Ana',
    detail: 'Urgente · Diário de humor · há 1 hora',
    to: '/patients/p1/copilot',
    tone: 'error',
    sortAt: 1,
    clinicalId: 'a1',
    severity: 'SEVERE',
    ...partial,
  };
}

describe('DashboardHeaderTools', () => {
  it('leva para a página de ajuda e abre as notificações no sininho', () => {
    render(
      <MemoryRouter>
        <DashboardHeaderTools notifications={[item(), item({ id: 'agenda-1', group: 'agenda', kind: 'agenda', title: 'Sessão' })]} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Abrir ajuda' })).toHaveAttribute('href', '/ajuda');
    fireEvent.click(screen.getByRole('button', { name: 'Notificações, 2 pendências' }));
    expect(screen.getByRole('heading', { name: 'Notificações' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Todas/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Alertas e crises/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Agendamentos/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Pendências/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Agendamentos/ }));
    expect(screen.queryByText('Ana')).toBeNull();
    expect(screen.getByText('Sessão')).toBeTruthy();
  });

  it('mostra o sininho sem badge quando não há pendências', () => {
    render(
      <MemoryRouter>
        <DashboardHeaderTools notifications={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Notificações' })).toBeTruthy();
  });
});
