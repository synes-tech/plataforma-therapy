import { Link } from 'react-router-dom';
import { ListPageSkeleton } from '@containers/loading';
import type { ClinicTeamMember, ClinicWeekRow } from './dashboard.types';
import { formatScheduleTime } from './dashboard.time';

export function ClinicAdminTeam({
  team,
  week,
  loading,
}: {
  team: ClinicTeamMember[];
  week: ClinicWeekRow[];
  loading?: boolean;
}) {
  const max = Math.max(1, ...week.map((row) => row.sessions));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-charcoal">Equipe hoje</h2>
          <Link to="/professionals" className="text-xs font-medium text-primary hover:underline">
            Gerenciar
          </Link>
        </div>
        {loading ? (
          <ListPageSkeleton rows={3} rowClassName="h-12" />
        ) : team.length === 0 ? (
          <p className="py-6 text-sm text-charcoal-muted">Nenhum profissional cadastrado.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {team.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-charcoal">{member.name}</p>
                  <p className="truncate text-xs text-charcoal-muted">
                    {member.sessions_today === 0
                      ? 'Sem sessões hoje'
                      : member.next_at
                        ? `Próxima ${formatScheduleTime(member.next_at)}${member.next_patient ? ` · ${member.next_patient}` : ''}`
                        : `${member.sessions_today} sessão${member.sessions_today === 1 ? '' : 'ões'}`}
                  </p>
                </div>
                <span className="shrink-0 font-display text-sm font-bold tabular-nums tracking-tight text-charcoal">
                  {member.sessions_today}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 font-display text-sm font-semibold text-charcoal">Sessões na semana</h2>
        {loading ? (
          <ListPageSkeleton rows={3} rowClassName="h-10" />
        ) : week.length === 0 ? (
          <p className="py-6 text-sm text-charcoal-muted">Sem agenda na semana.</p>
        ) : (
          <ul className="space-y-3">
            {week.map((row) => (
              <li key={row.id}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-charcoal">{row.name}</span>
                  <span className="font-display font-bold tabular-nums tracking-tight text-charcoal">{row.sessions}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(row.sessions / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
