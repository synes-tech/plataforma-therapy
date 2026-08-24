import type { PatientSessionRecord } from '../session/session-history.types';
import {
  buildSessionPreview,
  buildSessionTitle,
  formatSessionDateShort,
} from './patient-sessions.format';

interface PatientSessionsTableProps {
  items: PatientSessionRecord[];
  onView: (session: PatientSessionRecord) => void;
  onOpenReport: (session: PatientSessionRecord) => void;
  reportArtifactId: (session: PatientSessionRecord) => string | null;
}

const REPORT_BUTTON =
  'inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-charcoal-muted disabled:shadow-none';

function SessionReportCell({
  session,
  onOpenReport,
  reportArtifactId,
  fullWidth,
}: {
  session: PatientSessionRecord;
  onOpenReport: (session: PatientSessionRecord) => void;
  reportArtifactId: (session: PatientSessionRecord) => string | null;
  fullWidth?: boolean;
}) {
  const hasReport = Boolean(reportArtifactId(session));

  return (
    <button
      type="button"
      onClick={() => onOpenReport(session)}
      disabled={!hasReport}
      className={`${REPORT_BUTTON} ${fullWidth ? 'w-full' : ''}`}
      aria-label={hasReport ? 'Acesse o relatório' : 'Relatório ainda não salvo'}
    >
      ACESSE O RELATÓRIO
    </button>
  );
}

export function PatientSessionsTable({
  items,
  onView,
  onOpenReport,
  reportArtifactId,
}: PatientSessionsTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
              <th className="w-[7.5rem] px-5 py-3 font-semibold">Data</th>
              <th className="px-5 py-3 font-semibold">Título / Resumo</th>
              <th className="w-[13.5rem] px-5 py-3 font-semibold">Relatório</th>
              <th className="w-[10rem] px-5 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((session) => {
              const title = buildSessionTitle(session.data_sessao);
              const preview = buildSessionPreview(session);
              const dateShort = formatSessionDateShort(session.data_sessao);

              return (
                <tr key={session.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-5 py-3.5 text-charcoal-muted">
                    <time dateTime={session.data_sessao}>{dateShort}</time>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-charcoal">{title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-charcoal-muted">{preview}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <SessionReportCell
                      session={session}
                      onOpenReport={onOpenReport}
                      reportArtifactId={reportArtifactId}
                    />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => onView(session)}
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-charcoal px-3.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98]"
                      aria-label="Visualizar sessão"
                    >
                      VISUALIZAR
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {items.map((session) => {
          const dateShort = formatSessionDateShort(session.data_sessao);
          const preview = buildSessionPreview(session);

          return (
            <article key={session.id} className="space-y-3 px-4 py-4">
              <time dateTime={session.data_sessao} className="text-xs font-medium text-charcoal-muted">
                {dateShort}
              </time>
              <p className="line-clamp-2 text-sm text-charcoal">{preview}</p>
              <div className="grid grid-cols-1 gap-2">
                <SessionReportCell
                  session={session}
                  onOpenReport={onOpenReport}
                  reportArtifactId={reportArtifactId}
                  fullWidth
                />
                <button
                  type="button"
                  onClick={() => onView(session)}
                  className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-charcoal px-3.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm"
                >
                  VISUALIZAR
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
