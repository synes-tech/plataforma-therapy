import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardNotificationItem } from './dashboard-notifications.types';
import {
  dashboardNotificationBadgeCount,
  dashboardNotificationsHaveSevere,
} from './dashboard-notifications.utils';
import { DashboardNotificationsModal } from './DashboardNotificationsModal';

const ICON_BTN =
  'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-charcoal-muted transition-colors hover:bg-slate-100 hover:text-charcoal';

interface DashboardHeaderToolsProps {
  notifications: DashboardNotificationItem[];
  alertsError?: boolean;
  onAcknowledge?: (alertId: string) => void;
  acknowledgingId?: string | null;
  removingIds?: ReadonlySet<string>;
}

function HelpIcon() {
  return (
    <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

export function DashboardHeaderTools({
  notifications,
  alertsError,
  onAcknowledge,
  acknowledgingId,
  removingIds,
}: DashboardHeaderToolsProps) {
  const [open, setOpen] = useState(false);
  const count = dashboardNotificationBadgeCount(notifications);
  const severe = dashboardNotificationsHaveSevere(notifications);
  const badge = count > 9 ? '9+' : String(count);
  const bellLabel =
    count === 0 ? 'Notificações' : count === 1 ? 'Notificações, 1 pendência' : `Notificações, ${count} pendências`;

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <Link to="/ajuda" className={ICON_BTN} aria-label="Abrir ajuda" title="Ajuda">
          <HelpIcon />
        </Link>
        <button
          type="button"
          className={ICON_BTN}
          aria-label={bellLabel}
          title="Notificações"
          onClick={() => setOpen(true)}
        >
          <BellIcon />
          {count > 0 ? (
            <span
              className={`absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none text-white ${
                severe || alertsError ? 'bg-error' : 'bg-primary'
              }`}
            >
              {badge}
            </span>
          ) : null}
        </button>
      </div>

      <DashboardNotificationsModal
        isOpen={open}
        onClose={() => setOpen(false)}
        items={notifications}
        error={alertsError}
        onAcknowledge={onAcknowledge}
        acknowledgingId={acknowledgingId}
        removingIds={removingIds}
      />
    </>
  );
}
