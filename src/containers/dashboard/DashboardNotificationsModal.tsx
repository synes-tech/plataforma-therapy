import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MobileNavSelect } from '@shared/ui/MobileNavSelect';
import { StandardModal } from '@shared/ui/StandardModal';
import type { DashboardNotificationFilter, DashboardNotificationItem } from './dashboard-notifications.types';
import {
  DASHBOARD_NOTIFICATION_FILTER_EMPTY,
  DASHBOARD_NOTIFICATION_FILTERS,
  DASHBOARD_NOTIFICATION_GROUP_LABEL,
  dashboardNotificationFilterCount,
  filterDashboardNotifications,
  groupDashboardNotifications,
} from './dashboard-notifications.utils';

const TONE_BAR = {
  alert: 'border-l-alert',
  error: 'border-l-error',
  primary: 'border-l-primary',
  slate: 'border-l-slate-300',
} as const;

interface DashboardNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DashboardNotificationItem[];
  error?: boolean;
  onAcknowledge?: (alertId: string) => void;
  acknowledgingId?: string | null;
  removingIds?: ReadonlySet<string>;
}

export function DashboardNotificationsModal({
  isOpen,
  onClose,
  items,
  error,
  onAcknowledge,
  acknowledgingId,
  removingIds,
}: DashboardNotificationsModalProps) {
  const [filter, setFilter] = useState<DashboardNotificationFilter>('all');

  useEffect(() => {
    if (!isOpen) setFilter('all');
  }, [isOpen]);

  const visible = filterDashboardNotifications(items, filter);
  const sections =
    filter === 'all'
      ? groupDashboardNotifications(visible)
      : visible.length > 0
        ? [
            {
              group: filter,
              label: DASHBOARD_NOTIFICATION_GROUP_LABEL[filter],
              items: visible,
            },
          ]
        : [];

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Notificações"
      size="3xl"
      dialogClassName="h-[min(40rem,92dvh)] md:h-[min(40rem,90dvh)]"
      bodyClassName="flex flex-col overflow-hidden"
    >
      <p className="mb-4 shrink-0 text-sm text-charcoal-muted">
        Alertas, crises, agenda de hoje e pendências da conta — tudo em um só lugar.
      </p>

      <nav className="mb-5 shrink-0" aria-label="Filtrar notificações">
        <MobileNavSelect
          value={filter}
          options={DASHBOARD_NOTIFICATION_FILTERS.map((tab) => ({
            value: tab.id,
            label: `${tab.label} (${dashboardNotificationFilterCount(items, tab.id)})`,
          }))}
          onChange={setFilter}
          ariaLabel="Filtrar notificações"
          className="w-full"
          visibilityClassName="md:hidden"
          menuClassName="z-[70]"
        />

        <div
          className="hidden w-full items-stretch gap-1 overflow-x-auto rounded-xl border border-[#E4D5C8] bg-[#F0E6DC] p-1 md:flex"
          role="tablist"
        >
          {DASHBOARD_NOTIFICATION_FILTERS.map((tab) => {
            const isActive = filter === tab.id;
            const count = dashboardNotificationFilterCount(items, tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(tab.id)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors ${
                  isActive ? 'bg-white text-primary shadow-sm' : 'text-charcoal-muted hover:text-charcoal'
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 font-display text-[10px] font-bold tabular-nums ${
                    isActive ? 'bg-primary-50 text-primary-dark' : 'bg-white/70 text-charcoal-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {error ? (
        <p role="alert" className="mb-4 shrink-0 rounded-xl border border-error/15 bg-error-light/50 px-4 py-3 text-sm text-error">
          Não foi possível carregar os alertas clínicos. O restante das notificações continua visível.
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {sections.length === 0 ? (
          <div className="flex min-h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <div>
              <p className="text-sm font-medium text-charcoal">Tudo em dia</p>
              <p className="mt-1 text-sm text-charcoal-muted">{DASHBOARD_NOTIFICATION_FILTER_EMPTY[filter]}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {sections.map((section) => (
              <section key={section.group} aria-labelledby={`notify-${section.group}`}>
                {filter === 'all' ? (
                  <h3
                    id={`notify-${section.group}`}
                    className="mb-2 font-display text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted"
                  >
                    {section.label}
                  </h3>
                ) : (
                  <h3 id={`notify-${section.group}`} className="sr-only">
                    {section.label}
                  </h3>
                )}
                <ul className="space-y-2">
                  {section.items.map((item) => {
                    const removing = item.clinicalId ? Boolean(removingIds?.has(item.clinicalId)) : false;
                    const acknowledging = item.clinicalId ? acknowledgingId === item.clinicalId : false;

                    return (
                      <li
                        key={item.id}
                        className={`rounded-xl border border-slate-100 border-l-[3px] bg-white ${TONE_BAR[item.tone]} ${
                          removing ? 'pointer-events-none opacity-0' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-charcoal">{item.title}</p>
                            <p className="mt-0.5 truncate text-[11px] text-charcoal-muted">{item.detail}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {item.clinicalId && onAcknowledge ? (
                              <button
                                type="button"
                                onClick={() => onAcknowledge(item.clinicalId!)}
                                disabled={acknowledging || removing}
                                className="inline-flex h-9 items-center rounded-lg bg-slate-100 px-2.5 text-[11px] font-medium text-charcoal hover:bg-slate-200 disabled:opacity-60"
                              >
                                {acknowledging ? '…' : 'Arquivar'}
                              </button>
                            ) : null}
                            <Link
                              to={item.to}
                              onClick={onClose}
                              className="inline-flex h-9 items-center rounded-lg bg-charcoal px-2.5 text-[11px] font-medium text-white hover:bg-charcoal-light"
                            >
                              Abrir
                            </Link>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </StandardModal>
  );
}
