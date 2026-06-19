import { Link } from 'react-router-dom';
import { ListPageSkeleton } from '@containers/loading';
import { PatientAvatar } from '@containers/patient/PatientAvatar';
import type { ScheduleItem } from './dashboard.types';
import { formatScheduleTime, getPatientAge } from './dashboard.utils';

function SparkIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8L12 2z" />
    </svg>
  );
}

function CoffeeCalendarIllustration() {
  return (
    <svg className="h-14 w-14 text-slate-300" viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="14" y="18" width="28" height="34" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M22 14h12M28 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M42 28h6a6 6 0 010 12h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 42h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function ScheduleRow({ item }: { item: ScheduleItem }) {
  const name = item.patient?.name ?? item.title ?? 'Sessão';
  const age = getPatientAge(item.patient?.birth_date);

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-medium text-charcoal">{formatScheduleTime(item.scheduled_at)}</p>
          {item.duration_minutes && (
            <p className="font-mono text-[11px] text-charcoal-muted/60">{item.duration_minutes}min</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <PatientAvatar name={name} fotoUrl={item.patient?.foto_url} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-charcoal">
              {name}
              {age && <span className="ml-1 text-xs font-normal text-charcoal-muted">· {age}</span>}
            </p>
            <p className="text-xs capitalize text-charcoal-muted">{item.title ?? 'Atendimento'}</p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-14 sm:pl-0">
        {item.patient && (
          <Link
            to={`/patients/${item.patient.id}/copilot`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
          >
            <SparkIcon />
            Preparar com IA
          </Link>
        )}
        {item.patient && (
          <Link
            to={`/session/${item.patient.id}`}
            className="inline-flex items-center rounded-lg bg-charcoal px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-charcoal-light"
          >
            Iniciar
          </Link>
        )}
      </div>
    </div>
  );
}

function AgendaEmptyState() {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50">
        <CoffeeCalendarIllustration />
      </div>
      <p className="text-sm font-medium text-charcoal">Agenda livre hoje</p>
      <p className="mt-1 max-w-xs text-sm text-charcoal-muted/80">
        Nenhum atendimento agendado. Aproveite para revisar prontuários ou planejar a semana.
      </p>
      <Link
        to="/agenda"
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:border-primary/30 hover:text-primary"
      >
        Ir para a Agenda
      </Link>
    </div>
  );
}

interface DashboardAgendaCardProps {
  schedule: ScheduleItem[];
  loading?: boolean;
}

export function DashboardAgendaCard({ schedule, loading }: DashboardAgendaCardProps) {
  return (
    <section className="lg:col-span-8" aria-labelledby="agenda-title">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="agenda-title" className="font-display text-base font-semibold text-charcoal">
          Agenda de Hoje
        </h2>
        <Link to="/agenda" className="text-xs font-medium text-primary hover:text-primary-dark">
          Ver agenda →
        </Link>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        {loading ? (
          <ListPageSkeleton rows={3} rowClassName="h-20" className="space-y-px" />
        ) : schedule.length === 0 ? (
          <AgendaEmptyState />
        ) : (
          schedule.map((item) => <ScheduleRow key={item.id} item={item} />)
        )}
      </div>
    </section>
  );
}
