/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import type { ClinicalAlertItem } from './clinical-alerts.types';
import type { BriefingData, ScheduleItem } from './dashboard.types';
import {
  buildClinicDashboardNotifications,
  buildDashboardNotifications,
  dashboardNotificationBadgeCount,
  dashboardNotificationFilterCount,
  dashboardNotificationsHaveSevere,
  filterDashboardNotifications,
  groupDashboardNotifications,
} from './dashboard-notifications.utils';
import { withSummaryDefaults } from './home.utils';

const NOW = new Date('2026-08-14T14:20:00-03:00').getTime();

function alert(partial: Partial<ClinicalAlertItem> = {}): ClinicalAlertItem {
  return {
    id: 'a1',
    patient_id: 'p1',
    patient_name: 'Ana',
    patient_foto_url: null,
    clinic_id: 'c1',
    professional_id: 'pr1',
    source: 'DIARY',
    severity: 'MODERATE',
    status: 'UNREAD',
    title: 'Crise no diário',
    summary: 'Família registrou crise.',
    source_ref_id: null,
    occurred_at: '2026-08-14T13:00:00-03:00',
    notify_now: true,
    metadata: {},
    ...partial,
  };
}

function session(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 's1',
    title: 'Sessão',
    scheduled_at: '2026-08-14T16:00:00-03:00',
    duration_minutes: 50,
    status: 'scheduled',
    patient: { id: 'p1', name: 'Ana' },
    ...overrides,
  };
}

function briefing(overrides: Partial<BriefingData> = {}): BriefingData {
  return {
    professional: { id: 'pro', name: 'João' },
    date: '2026-08-14',
    schedule: [],
    alerts: [],
    summary: withSummaryDefaults(),
    pending_notes: [],
    family_unlinked: [],
    finance: null,
    ...overrides,
  };
}

describe('buildDashboardNotifications', () => {
  it('junta alertas clínicos, agenda de hoje e pendências', () => {
    const items = buildDashboardNotifications({
      clinicalAlerts: [alert({ severity: 'SEVERE' })],
      schedule: [
        session({ id: 'now', scheduled_at: '2026-08-14T14:00:00-03:00' }),
        session({ id: 'later', scheduled_at: '2026-08-14T16:00:00-03:00' }),
        session({ id: 'done', scheduled_at: '2026-08-14T09:00:00-03:00' }),
      ],
      briefing: briefing({
        pending_notes: [
          {
            patient_id: 'p2',
            patient_name: 'Bruno',
            schedule_id: 'sch-1',
            status: 'pending',
            scheduled_at: '2026-08-14T09:00:00-03:00',
          },
        ],
      }),
      canFinance: false,
      now: NOW,
    });

    expect(items.map((item) => item.group)).toEqual(['alerts', 'agenda', 'agenda', 'inbox']);
    expect(items[0]?.kind).toBe('clinical');
    expect(items[1]?.id).toBe('agenda-now');
    expect(items[2]?.id).toBe('agenda-later');
    expect(items[3]?.kind).toBe('note');
  });

  it('não duplica crise do diário quando já há alerta clínico', () => {
    const items = buildDashboardNotifications({
      clinicalAlerts: [alert()],
      briefing: briefing({
        alerts: [
          {
            id: 'diary-1',
            type: 'crisis',
            patient: { id: 'p1', name: 'Ana' },
            entry_date: '2026-08-14',
            notes: null,
            crisis_level: 4,
            hours_ago: 1,
          },
        ],
      }),
      now: NOW,
    });

    expect(items.filter((item) => item.group === 'alerts')).toHaveLength(1);
    expect(items[0]?.kind).toBe('clinical');
  });

  it('usa a crise do briefing quando não há alerta clínico', () => {
    const items = buildDashboardNotifications({
      clinicalAlerts: [],
      briefing: briefing({
        alerts: [
          {
            id: 'diary-1',
            type: 'crisis',
            patient: { id: 'p1', name: 'Ana' },
            entry_date: '2026-08-14',
            notes: null,
            crisis_level: 4,
            hours_ago: 1,
          },
        ],
      }),
      now: NOW,
    });

    expect(items[0]?.kind).toBe('crisis');
    expect(items[0]?.to).toContain('/checkins');
  });

  it('agrupa seções na ordem alertas, agenda e pendências', () => {
    const grouped = groupDashboardNotifications(
      buildDashboardNotifications({
        clinicalAlerts: [alert()],
        schedule: [session()],
        briefing: briefing({ family_unlinked: [{ id: 'p3', name: 'Caio' }] }),
        now: NOW,
      }),
    );

    expect(grouped.map((section) => section.group)).toEqual(['alerts', 'agenda', 'inbox']);
  });

  it('marca badge grave quando há crise urgente', () => {
    const items = buildDashboardNotifications({
      clinicalAlerts: [alert({ severity: 'SEVERE' })],
      now: NOW,
    });
    expect(dashboardNotificationBadgeCount(items)).toBe(1);
    expect(dashboardNotificationsHaveSevere(items)).toBe(true);
  });
});

describe('buildClinicDashboardNotifications', () => {
  it('inclui alertas, próxima sessão da equipe e vínculos pendentes', () => {
    const items = buildClinicDashboardNotifications({
      clinicalAlerts: [alert()],
      pendingFamilyLinks: 2,
      team: [
        {
          id: 't1',
          name: 'Lívia',
          specialty: 'TO',
          sessions_today: 3,
          next_at: '2026-08-14T16:00:00-03:00',
          next_patient: 'Ana',
        },
      ],
      now: NOW,
    });

    expect(items.map((item) => item.group)).toEqual(['alerts', 'agenda', 'inbox']);
    expect(items[1]?.title).toBe('Ana');
    expect(items[2]?.detail).toContain('2 pacientes');
  });
});

describe('filterDashboardNotifications', () => {
  const items = buildDashboardNotifications({
    clinicalAlerts: [alert()],
    schedule: [session()],
    briefing: briefing({ family_unlinked: [{ id: 'p3', name: 'Caio' }] }),
    now: NOW,
  });

  it('mantém tudo no filtro Todas', () => {
    expect(filterDashboardNotifications(items, 'all')).toHaveLength(3);
    expect(dashboardNotificationFilterCount(items, 'all')).toBe(3);
  });

  it('isola alertas, agenda e pendências', () => {
    expect(filterDashboardNotifications(items, 'alerts').every((item) => item.group === 'alerts')).toBe(true);
    expect(filterDashboardNotifications(items, 'agenda').map((item) => item.kind)).toEqual(['agenda']);
    expect(filterDashboardNotifications(items, 'inbox').map((item) => item.kind)).toEqual(['family']);
  });
});
