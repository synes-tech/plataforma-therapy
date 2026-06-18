import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { callFunction } from '@shared/lib/api';
import { getFirstName, getTimeGreeting } from '@shared/lib/greeting';

interface DashboardProfessional {
  id: string;
  name: string;
  specialty: string | null;
  status: string;
}

interface ClinicDashboardData {
  admin_name: string;
  clinic_name: string;
  professionals_count: number;
  max_professionals: number;
  patients_count: number;
  ai_reports_this_month: number;
  recent_professionals: DashboardProfessional[];
}

function KpiCard({
  label,
  value,
  detail,
  className = '',
}: {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div
      className={`min-w-[10.5rem] shrink-0 snap-start rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm md:min-w-0 ${className}`}
    >
      <p className="text-xs font-medium text-charcoal-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight text-charcoal">{value}</p>
      {detail && <p className="mt-1 text-xs text-charcoal-muted">{detail}</p>}
    </div>
  );
}

function ProfessionalRow({ professional }: { professional: DashboardProfessional }) {
  const specialty = professional.specialty ?? 'Especialidade não informada';

  return (
    <>
      {/* Desktop row */}
      <div className="hidden items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 md:flex">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-charcoal">{professional.name}</p>
          <p className="truncate text-xs text-charcoal-muted">{specialty}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            to="/patients"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal transition-colors hover:border-primary/40 hover:bg-primary-50 hover:text-primary-dark"
          >
            Prontuários
          </Link>
          <Link
            to="/professionals"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal transition-colors hover:border-primary/40 hover:bg-primary-50 hover:text-primary-dark"
          >
            Gerenciar
          </Link>
        </div>
      </div>

      {/* Mobile card */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm md:hidden">
        <p className="text-sm font-medium text-charcoal">{professional.name}</p>
        <p className="mt-0.5 text-xs text-charcoal-muted">{specialty}</p>
        <div className="mt-3 flex gap-2">
          <Link
            to="/patients"
            className="inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal"
          >
            Ver prontuários
          </Link>
          <Link
            to="/professionals"
            className="inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal"
          >
            Gerenciar
          </Link>
        </div>
      </div>
    </>
  );
}

export function ClinicAdminDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['clinic-dashboard'],
    queryFn: () => callFunction<ClinicDashboardData>('get-clinic-dashboard', {}),
  });

  const greeting = getTimeGreeting();
  const adminName = data?.admin_name ?? 'Admin';
  const firstName = getFirstName(adminName);

  return (
    <div className="bg-[#F8FAF9] px-5 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <header className="mb-6 md:mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
              {greeting}, {firstName}.
            </h1>
            <p className="mt-1 text-sm text-charcoal-muted">
              Visão geral da sua clínica hoje.
            </p>
          </div>
          <Link
            to="/professionals"
            className="hidden h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-charcoal px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98] md:inline-flex"
          >
            <span className="text-base leading-none">+</span>
            Novo Profissional
          </Link>
        </div>

        {/* Mobile CTA */}
        <Link
          to="/professionals"
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-charcoal text-sm font-medium text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98] md:hidden"
        >
          <span className="text-base leading-none">+</span>
          Adicionar Profissional
        </Link>
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
          Não foi possível carregar os dados do painel. Tente novamente.
        </div>
      )}

      {/* KPIs — scroll horizontal no mobile */}
      <section aria-label="Métricas da clínica">
        <p className="mb-3 text-xs font-medium text-charcoal-muted md:hidden">Visão Geral (deslize ↔)</p>
        <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible md:pb-0">
          <KpiCard
            label="Profissionais"
            value={isLoading ? '—' : String(data?.professionals_count ?? 0)}
            detail={
              isLoading
                ? undefined
                : `${data?.professionals_count ?? 0} / ${data?.max_professionals ?? 0} na cota`
            }
          />
          <KpiCard
            label="Pacientes Ativos"
            value={isLoading ? '—' : String(data?.patients_count ?? 0)}
            detail={isLoading ? undefined : 'cadastrados na clínica'}
          />
          <KpiCard
            label="Relatórios IA"
            value={isLoading ? '—' : String(data?.ai_reports_this_month ?? 0)}
            detail={isLoading ? undefined : 'gerados este mês'}
          />
        </div>
      </section>

      {/* Atalho prontuários da clínica */}
      <section className="mt-8" aria-labelledby="clinic-records-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="clinic-records-title" className="font-display text-base font-semibold text-charcoal">
            Prontuários da clínica
          </h2>
          <Link
            to="/patients"
            className="text-xs font-medium text-primary hover:text-primary-dark"
          >
            Ver todos ({isLoading ? '—' : data?.patients_count ?? 0})
          </Link>
        </div>
        <p className="mt-1 text-xs text-charcoal-muted">
          Acesso de leitura a todos os pacientes vinculados aos seus profissionais.
        </p>
        <Link
          to="/patients"
          className="mt-4 flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary-50/30"
        >
          <div>
            <p className="text-sm font-medium text-charcoal">Explorar pacientes</p>
            <p className="text-xs text-charcoal-muted">Abrir lista completa com atalho ao prontuário</p>
          </div>
          <span className="text-primary" aria-hidden>→</span>
        </Link>
      </section>

      {/* Profissionais recentes */}
      <section className="mt-8" aria-labelledby="recent-professionals-title">
        <h2
          id="recent-professionals-title"
          className="mb-4 font-display text-base font-semibold text-charcoal"
        >
          Profissionais Recentes
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : (data?.recent_professionals.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
            <p className="text-sm text-charcoal-muted">Nenhum profissional cadastrado ainda.</p>
            <Link
              to="/professionals"
              className="mt-3 inline-flex text-sm font-medium text-primary hover:text-primary-dark"
            >
              Convidar o primeiro profissional →
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm md:block">
              {data?.recent_professionals.map((prof) => (
                <ProfessionalRow key={prof.id} professional={prof} />
              ))}
            </div>
            <div className="space-y-3 md:hidden">
              {data?.recent_professionals.map((prof) => (
                <ProfessionalRow key={prof.id} professional={prof} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
