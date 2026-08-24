import type { FamilySessionHistoryItem } from './family-session.types';

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTimeShort(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function resolveSessionTime(session: FamilySessionHistoryItem): string {
  return session.horario_sessao || formatTimeShort(session.data_sessao);
}

interface FamilySessionsTableProps {
  patientName: string;
  items: FamilySessionHistoryItem[];
  onView: (session: FamilySessionHistoryItem) => void;
}

export function FamilySessionsTable({ patientName, items, onView }: FamilySessionsTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
              <th className="w-[7.5rem] px-5 py-3 font-semibold">Data</th>
              <th className="w-[5.5rem] px-5 py-3 font-semibold">Horário</th>
              <th className="px-5 py-3 font-semibold">Paciente / Profissional</th>
              <th className="w-[10rem] px-5 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((session) => (
              <tr key={session.id} className="transition-colors hover:bg-slate-50/60">
                <td className="whitespace-nowrap px-5 py-3.5 text-charcoal-muted">
                  <time dateTime={session.data_sessao}>{formatDateShort(session.data_sessao)}</time>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 font-medium text-charcoal">
                  {resolveSessionTime(session)}
                </td>
                <td className="px-5 py-3.5">
                  <p className="font-medium text-charcoal">{patientName}</p>
                  <p className="mt-0.5 text-xs text-charcoal-muted">
                    Atendido(a) por <span className="font-medium text-charcoal">{session.therapist_name}</span>
                  </p>
                  {session.report_preview ? (
                    <p className="mt-1 line-clamp-1 text-xs text-charcoal-muted/90">{session.report_preview}</p>
                  ) : null}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => onView(session)}
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-charcoal px-3.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition-all hover:bg-charcoal-light"
                  >
                    Visualizar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {items.map((session) => (
          <article key={session.id} className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-charcoal-muted">
              <time dateTime={session.data_sessao}>{formatDateShort(session.data_sessao)}</time>
              <span aria-hidden>·</span>
              <span className="font-medium text-charcoal">{resolveSessionTime(session)}</span>
            </div>
            <p className="text-sm font-medium text-charcoal">{patientName}</p>
            <p className="text-sm text-charcoal-muted">
              Atendido(a) por <span className="font-medium text-charcoal">{session.therapist_name}</span>
            </p>
            {session.report_preview ? (
              <p className="line-clamp-2 text-sm text-charcoal-muted">{session.report_preview}</p>
            ) : null}
            <button
              type="button"
              onClick={() => onView(session)}
              className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-charcoal text-xs font-semibold uppercase tracking-wide text-white"
            >
              Visualizar
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
