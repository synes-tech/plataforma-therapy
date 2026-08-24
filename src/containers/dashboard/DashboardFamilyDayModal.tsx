import { Link } from 'react-router-dom';
import { PatientAvatar } from '@containers/patient/PatientAvatar';
import { StandardModal } from '@shared/ui/StandardModal';
import type { DiaryMonthCheckin } from './dashboard.types';
import { checkinsForDay, formatDiaryCheckinTime, formatLongDate } from './home.utils';

interface DashboardFamilyDayModalProps {
  date: string | null;
  entries?: DiaryMonthCheckin[];
  onClose: () => void;
}

export function DashboardFamilyDayModal({ date, entries, onClose }: DashboardFamilyDayModalProps) {
  const isOpen = date !== null;
  const checkins = date ? checkinsForDay(entries, date) : [];
  const title = date ? formatLongDate(date) : 'Check-ins do dia';

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-charcoal px-5 text-sm font-semibold text-white hover:bg-charcoal-light sm:w-auto"
        >
          Fechar
        </button>
      }
    >
      {checkins.length === 0 ? (
        <p className="text-sm text-charcoal-muted">Nenhum check-in da família neste dia.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {checkins.map((checkin) => {
            const time = formatDiaryCheckinTime(checkin.created_at);
            return (
              <li key={checkin.id}>
                <Link
                  to={`/patients/${checkin.patient_id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl px-1 py-3 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <PatientAvatar name={checkin.patient_name} fotoUrl={checkin.foto_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold text-charcoal">{checkin.patient_name}</p>
                    <p className="mt-0.5 text-xs text-charcoal-muted">
                      {time ? `Check-in às ${time}` : 'Check-in da família'}
                    </p>
                  </div>
                  {checkin.crisis_occurred ? (
                    <span className="shrink-0 rounded-full bg-alert/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-alert">
                      Crise
                    </span>
                  ) : null}
                  <span className="shrink-0 text-xs font-medium text-primary">Abrir central</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </StandardModal>
  );
}
