import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { callFunction } from '@shared/lib/api';
import { getFirstName, getTimeGreeting, getInitials } from '@shared/lib/greeting';

interface BriefingPatient {
  id: string;
  name: string;
  birth_date?: string | null;
}

interface ScheduleItem {
  id: string;
  title: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: string;
  patient: BriefingPatient | null;
}

interface AlertItem {
  id: string;
  type: 'crisis' | 'positive';
  patient: { id: string; name: string } | null;
  entry_date: string;
  notes: string | null;
  crisis_level: number | null;
  hours_ago: number;
}

interface BriefingData {
  professional: { id: string; name: string };
  date: string;
  schedule: ScheduleItem[];
  alerts: AlertItem[];
  summary: { sessions_today: number; alerts_count: number; crisis_count: number };
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

function getAge(birthDate?: string | null): string {
  if (!birthDate) return '';
  const years = Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return Number.isFinite(years) ? `${years}a` : '';
}

function MicIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1.5a3 3 0 00-3 3v6a3 3 0 006 0v-6a3 3 0 00-3-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5a7 7 0 0014 0M12 17.5V21m-3 0h6" />
    </svg>
  );
}

function SparkIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8L12 2z" />
    </svg>
  );
}

function subtitleFor(summary?: BriefingData['summary']): string {
  if (!summary) return 'Carregando seu resumo de hoje...';
  const { sessions_today } = summary;
  if (sessions_today === 0) return 'Você não tem atendimentos programados para hoje.';
  if (sessions_today === 1) return 'Você tem 1 atendimento programado para hoje.';
  return `Você tem ${sessions_today} atendimentos programados para hoje.`;
}

function ScheduleRow({ item }: { item: ScheduleItem }) {
  const name = item.patient?.name ?? item.title ?? 'Sessão';
  const age = getAge(item.patient?.birth_date);

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-medium text-charcoal">{formatTime(item.scheduled_at)}</p>
          {item.duration_minutes && (
            <p className="font-mono text-[11px] text-charcoal-muted/60">{item.duration_minutes}min</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
            {getInitials(name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-charcoal">
              {name}
              {age && <span className="ml-1 text-xs font-normal text-charcoal-muted">· {age}</span>}
            </p>
            <p className="text-xs text-charcoal-muted capitalize">{item.title ?? 'Atendimento'}</p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 pl-14 sm:pl-0">
        {item.patient && (
          <Link
            to={`/copilot/${item.patient.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-1.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
          >
            <SparkIcon className="h-3.5 w-3.5" />
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

function AlertCard({ alert }: { alert: AlertItem }) {
  const isCrisis = alert.type === 'crisis';
  const accent = isCrisis ? 'border-l-alert' : 'border-l-mint';
  const tag = isCrisis ? 'Atenção' : 'Avanço';
  const tagClass = isCrisis ? 'bg-alert-bg text-alert' : 'bg-mint-50 text-mint-dark';

  return (
    <div className={`rounded-xl border border-slate-100 border-l-4 bg-slate-50 p-4 ${accent}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-charcoal">
          {alert.patient?.name ?? 'Paciente'}
        </p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${tagClass}`}>
          {tag}
        </span>
      </div>
      {alert.notes && (
        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-charcoal-muted">{alert.notes}</p>
      )}
      <p className="mt-2 text-[11px] text-charcoal-muted/60">
        {alert.hours_ago === 0 ? 'agora há pouco' : `há ${alert.hours_ago}h`}
        {isCrisis && alert.crisis_level ? ` · nível ${alert.crisis_level}` : ''}
      </p>
    </div>
  );
}

export function ProfessionalDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['professional-briefing'],
    queryFn: () => callFunction<BriefingData>('get-professional-morning-briefing', {}),
  });

  const greeting = getTimeGreeting();
  const firstName = getFirstName(data?.professional.name ?? 'Terapeuta');
  const schedule = data?.schedule ?? [];
  const alerts = data?.alerts ?? [];

  return (
    <div className="bg-[#F8FAF9] px-5 py-6 lg:px-8 lg:py-8">
      {/* Header / Morning Briefing */}
      <header className="mb-6 md:mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
              {greeting}, {firstName}.
            </h1>
            <p className="mt-1 text-sm text-charcoal-muted">{subtitleFor(data?.summary)}</p>
          </div>
          <Link
            to="/patients"
            className="hidden h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-md transition-all hover:bg-primary-dark hover:shadow-lg active:scale-[0.98] md:inline-flex"
          >
            <MicIcon />
            Gravar Relatório Rápido
          </Link>
        </div>

        {/* Mobile quick action */}
        <Link
          to="/patients"
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-white shadow-md transition-all hover:bg-primary-dark active:scale-[0.98] md:hidden"
        >
          <MicIcon />
          Gravar Relatório Rápido
        </Link>
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
          Não foi possível carregar seu resumo de hoje. Tente novamente.
        </div>
      )}

      {/* Grid 60/40 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Agenda — 60% */}
        <section className="lg:col-span-7" aria-labelledby="agenda-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="agenda-title" className="font-display text-base font-semibold text-charcoal">
              Agenda de Hoje
            </h2>
            <Link to="/agenda" className="text-xs font-medium text-primary hover:text-primary-dark">
              Ver agenda →
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            {isLoading ? (
              <div className="space-y-px">
                <div className="h-20 animate-pulse bg-slate-50" />
                <div className="h-20 animate-pulse bg-slate-50" />
                <div className="h-20 animate-pulse bg-slate-50" />
              </div>
            ) : schedule.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-charcoal-muted/40">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-charcoal-muted">Nenhum atendimento agendado para hoje.</p>
                <p className="mt-1 text-xs text-charcoal-muted/60">Aproveite para revisar prontuários.</p>
              </div>
            ) : (
              schedule.map((item) => <ScheduleRow key={item.id} item={item} />)
            )}
          </div>
        </section>

        {/* Alertas — 40% */}
        <section className="lg:col-span-5" aria-labelledby="alerts-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="alerts-title" className="font-display text-base font-semibold text-charcoal">
              Alertas da Família
            </h2>
            {alerts.length > 0 && (
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-dark">
                {alerts.length}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
              <p className="text-sm text-charcoal-muted">Nenhum alerta nas últimas 24h.</p>
              <p className="mt-1 text-xs text-charcoal-muted/60">
                As atualizações do diário das famílias aparecem aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
