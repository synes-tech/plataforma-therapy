import { Link } from 'react-router-dom';
import { CountDonut, WeekBars } from './home-charts';
import type { PortfolioMix, WeekDayPoint } from './dashboard.types';
import { portfolioSlices } from './home.utils';

export function DashboardWeekCard({ points }: { points: WeekDayPoint[] }) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-3">
        <h2 className="font-display text-sm font-semibold text-charcoal">Sessões nos últimos 7 dias</h2>
        <p className="mt-0.5 text-xs text-charcoal-muted">Volume diário da sua agenda.</p>
      </header>
      <div className="flex min-h-0 flex-1 items-center">
        <WeekBars points={points} />
      </div>
      <Link to="/calendar" className="mt-3 text-xs font-medium text-primary hover:underline">
        Abrir agenda
      </Link>
    </section>
  );
}

export function DashboardPortfolioCard({
  mix,
  total,
}: {
  mix?: PortfolioMix;
  total: number;
}) {
  const slices = portfolioSlices(mix);
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-3 text-center">
        <h2 className="font-display text-sm font-semibold text-charcoal">Carteira</h2>
        <p className="mt-0.5 text-xs text-charcoal-muted">Vínculo e ritmo da carteira.</p>
      </header>
      <CountDonut
        slices={slices}
        centerLabel="Pacientes"
        centerValue={String(total)}
        emptyLabel="Nenhum paciente ativo na carteira."
      />
      <Link to="/patients" className="mt-3 text-center text-xs font-medium text-primary hover:underline">
        Ver pacientes
      </Link>
    </section>
  );
}
