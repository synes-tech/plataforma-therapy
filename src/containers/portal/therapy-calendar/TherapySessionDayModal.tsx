import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingButton, Spinner } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';
import { StandardModal } from '@shared/ui/StandardModal';
import { TherapyDaySessionCard } from './TherapyDaySessionCard';
import {
  THERAPY_STATUS_LABELS,
  type ScheduledTherapyDay,
  type ScheduledTherapySession,
} from './therapy-calendar.types';
import { formatTherapyDateLong } from './therapy-calendar.utils';

interface FamilySessionDetail {
  id: string;
  patient_name: string;
  data_sessao: string;
  therapist_name: string;
  session_title: string;
  scheduled_time: string | null;
  duration_minutes: number | null;
  report_shared: boolean;
  family_report: string | null;
}

interface TherapySessionDayModalProps {
  day: ScheduledTherapyDay | null;
  onClose: () => void;
}

function SessionDetailPanel({
  session,
  dayDate,
  onBack,
}: {
  session: ScheduledTherapySession;
  dayDate: string;
  onBack: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['family-session-detail', session.session_note_id],
    queryFn: () =>
      callFunction<FamilySessionDetail>('get-family-session-detail', {
        session_note_id: session.session_note_id!,
      }),
    enabled: !!session.session_note_id,
    staleTime: 60_000,
  });

  const dateLabel = formatTherapyDateLong(dayDate);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Voltar ao dia
      </button>

      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Spinner size="md" />
          <p className="text-sm text-charcoal-muted">Carregando sessão...</p>
        </div>
      ) : error ? (
        <p className="text-sm text-error" role="alert">
          {error instanceof Error ? error.message : 'Não foi possível carregar a sessão.'}
        </p>
      ) : data ? (
        <>
          <div className="rounded-xl border border-slate-100 bg-[#F8FAF9] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">Sessão</p>
            <h3 className="mt-1 font-serif text-lg text-charcoal">{data.session_title}</h3>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-charcoal-muted">Paciente</dt>
                <dd className="font-medium text-charcoal">{data.patient_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-charcoal-muted">Data</dt>
                <dd className="font-medium capitalize text-charcoal">{dateLabel}</dd>
              </div>
              <div>
                <dt className="text-xs text-charcoal-muted">Horário</dt>
                <dd className="font-medium text-charcoal">{data.scheduled_time ?? session.time}</dd>
              </div>
              <div>
                <dt className="text-xs text-charcoal-muted">Profissional</dt>
                <dd className="font-medium text-charcoal">{data.therapist_name}</dd>
              </div>
              {data.duration_minutes ? (
                <div>
                  <dt className="text-xs text-charcoal-muted">Duração</dt>
                  <dd className="font-medium text-charcoal">{data.duration_minutes} min</dd>
                </div>
              ) : null}
            </dl>
          </div>

          {data.report_shared && data.family_report ? (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
                Relatório da sessão
              </h4>
              <div className="max-h-[min(50vh,28rem)] overflow-y-auto rounded-xl border border-slate-100 bg-white px-4 py-3">
                <AiMarkdownContent content={data.family_report} variant="light" />
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function TherapySessionDayModal({ day, onClose }: TherapySessionDayModalProps) {
  const [detailSession, setDetailSession] = useState<ScheduledTherapySession | null>(null);
  const isOpen = day !== null;
  const title = day ? formatTherapyDateLong(day.date) : 'Sessões do dia';

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={() => {
        setDetailSession(null);
        onClose();
      }}
      title={detailSession ? 'Detalhes da sessão' : title}
      size="2xl"
      footer={
        <button
          type="button"
          onClick={() => {
            setDetailSession(null);
            onClose();
          }}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-charcoal px-5 text-sm font-semibold text-white transition-colors hover:bg-charcoal-light sm:w-auto"
        >
          Fechar
        </button>
      }
    >
      {day && !detailSession ? (
        <div className="space-y-4">
          <p className="text-sm text-charcoal-muted">
            {day.sessions.length === 1
              ? '1 sessão neste dia'
              : `${day.sessions.length} sessões neste dia`}
          </p>
          <ul className="space-y-3">
            {day.sessions.map((session) => {
              const statusLabel = THERAPY_STATUS_LABELS[session.status] ?? session.status;
              return (
                <li
                  key={session.id}
                  className="rounded-xl border border-slate-100 bg-white p-4 shadow-soft"
                >
                  <TherapyDaySessionCard session={session} />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-charcoal-muted">
                      {statusLabel}
                    </span>
                  </div>
                  {session.session_note_id ? (
                    <LoadingButton
                      type="button"
                      variant="dark"
                      className="mt-3 h-10 w-full sm:w-auto"
                      onClick={() => setDetailSession(session)}
                    >
                      Visualizar sessão
                    </LoadingButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : detailSession ? (
        <SessionDetailPanel
          session={detailSession}
          dayDate={day!.date}
          onBack={() => setDetailSession(null)}
        />
      ) : null}
    </StandardModal>
  );
}
