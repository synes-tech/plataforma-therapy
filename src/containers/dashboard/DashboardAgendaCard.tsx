import { Link } from 'react-router-dom';
import { ListPageSkeleton } from '@containers/loading';
import { PatientAvatar } from '@containers/patient/PatientAvatar';
import type { ScheduleItem } from './dashboard.types';
import { formatScheduleTime, getPatientAge } from './dashboard.time';
import { sessionPhase } from './home.utils';
import { sessionWorkspacePath } from '@containers/session-workspace/session-workspace.utils';

const PHASE_LABEL = {
  now: 'Agora',
  upcoming: 'A seguir',
  done: 'Concluída',
  missed: 'Cancelada',
} as const;

interface DashboardAgendaCardProps {
  schedule: ScheduleItem[];
  loading?: boolean;
}

export function DashboardAgendaCard({ schedule, loading }: DashboardAgendaCardProps) {
  return (
    <section className="lg:col-span-8" aria-labelledby="agenda-title">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="agenda-title" className="font-display text-base font-semibold text-charcoal">
          Agenda de hoje
        </h2>
        <Link to="/calendar" className="text-xs font-medium text-primary hover:text-primary-dark">
          Ver semana
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <ListPageSkeleton rows={3} rowClassName="h-20" className="space-y-px" />
        ) : schedule.length === 0 ? (
          <AgendaEmptyState />
        ) : (
          <ul className="divide-y divide-slate-100">
            {schedule.map((item) => (
              <ScheduleRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ScheduleRow({ item }: { item: ScheduleItem }) {
  const name = item.patient?.name ?? item.title ?? 'Sessão';
  const age = getPatientAge(item.patient?.birth_date);
  const phase = sessionPhase(item);
  const isNow = phase === 'now';

  return (
    <li className={`flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${isNow ? 'bg-primary-50/70' : ''}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="w-12 shrink-0 text-right">
          <p className="font-mono text-sm font-medium text-charcoal">{formatScheduleTime(item.scheduled_at)}</p>
          {item.duration_minutes ? (
            <p className="font-mono text-[11px] text-charcoal-muted">{item.duration_minutes}min</p>
          ) : null}
        </div>
        <PatientAvatar name={name} fotoUrl={item.patient?.foto_url} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-charcoal">
            {name}
            {age ? <span className="ml-1 text-xs font-normal text-charcoal-muted">· {age}</span> : null}
          </p>
          <p className="text-xs text-charcoal-muted">
            <span className={isNow ? 'font-semibold text-primary' : ''}>{PHASE_LABEL[phase]}</span>
            {item.title ? ` · ${item.title}` : ''}
          </p>
        </div>
      </div>

      {item.patient ? (
        <div className="flex shrink-0 flex-wrap gap-2 pl-14 sm:pl-0">
          <Link
            to={`/patients/${item.patient.id}/copilot`}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-charcoal hover:border-primary/30 hover:text-primary"
          >
            Preparar IA
          </Link>
          <Link
            to={sessionWorkspacePath(item.patient.id, item.id)}
            className="inline-flex h-9 items-center rounded-lg bg-charcoal px-3 text-xs font-medium text-white hover:bg-charcoal-light"
          >
            Iniciar
          </Link>
        </div>
      ) : null}
    </li>
  );
}

function AgendaEmptyState() {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-medium text-charcoal">Agenda livre hoje</p>
      <p className="mt-1 text-sm text-charcoal-muted">Revise pendências ou planeje a semana.</p>
      <Link
        to="/calendar"
        className="mt-4 inline-flex h-11 items-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal hover:border-primary/30 hover:text-primary"
      >
        Abrir agenda
      </Link>
    </div>
  );
}
