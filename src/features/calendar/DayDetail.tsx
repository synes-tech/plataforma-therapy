import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionWorkspacePath } from '@containers/session-workspace/session-workspace.utils';
import { PatientAvatar } from '@containers/patient/PatientAvatar';
import { LoadingButton } from '@containers/loading';
import { StandardModal } from '@shared/ui/StandardModal';
import { callFunction } from '@shared/lib/api';

interface Contact {
  name: string;
  phone: string | null;
  email: string | null;
}

interface DailySession {
  id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  session_note_id?: string | null;
  title: string | null;
  billing_status?: string | null;
  patient: { id: string; name: string; birth_date: string | null; foto_url?: string | null } | null;
  contact: Contact | null;
}

interface DailyData {
  date: string;
  sessions: DailySession[];
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  scheduled: { label: 'Agendado', className: 'bg-blue-50 text-blue-700' },
  in_progress: { label: 'Em andamento', className: 'bg-violet-50 text-violet-700' },
  completed: { label: 'Concluído', className: 'bg-emerald-50 text-emerald-700' },
  not_completed: { label: 'Não concluído', className: 'bg-red-50 text-red-700' },
  canceled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-500' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-500' },
  no_show: { label: 'Faltou', className: 'bg-amber-50 text-amber-700' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(d);
}

export function DayDetail({ date, onRescheduled }: { date: string; onRescheduled?: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['daily-sessions', date],
    queryFn: () => callFunction<DailyData>('get-daily-sessions', { date }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (error) {
    return <p className="py-6 text-center text-sm text-error">Não foi possível carregar a agenda deste dia.</p>;
  }

  const sessions = data?.sessions ?? [];

  if (sessions.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-charcoal-muted">Nenhum atendimento agendado para este dia.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {sessions.map((s) => (
        <SessionRow key={s.id} session={s} date={date} onRescheduled={onRescheduled} />
      ))}
    </ul>
  );
}

function SessionRow({ session, date, onRescheduled }: { session: DailySession; date: string; onRescheduled?: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [rescheduling, setRescheduling] = useState(false);
  const [newTime, setNewTime] = useState(formatTime(session.scheduled_at));
  const [newDate, setNewDate] = useState(date);
  const [reminderSent, setReminderSent] = useState(false);
  const [reminderPanelOpen, setReminderPanelOpen] = useState(false);
  const [reminderMode, setReminderMode] = useState<'now' | 'at'>('now');
  const [reminderDate, setReminderDate] = useState(date);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [cancelOpen, setCancelOpen] = useState(false);

  const name = session.patient?.name ?? session.title ?? 'Sessão';
  const meta = STATUS_META[session.status] ?? { label: session.status, className: 'bg-slate-100 text-slate-500' };

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      // monta ISO no fuso BR (-03:00)
      const iso = `${newDate}T${newTime}:00-03:00`;
      const parsed = new Date(iso);
      return callFunction('reschedule-session', { session_id: session.id, new_start: parsed.toISOString() });
    },
    onSuccess: () => {
      setRescheduling(false);
      queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
      queryClient.invalidateQueries({ queryKey: ['list-sessions'] });
      onRescheduled?.();
    },
  });

  const contact = session.contact;
  const waLink = contact?.phone ? `https://wa.me/${contact.phone.replace(/\D/g, '')}` : null;
  const mailLink = contact?.email ? `mailto:${contact.email}` : null;
  const contactLink = waLink ?? mailLink;
  const canStartSession =
    !!session.patient &&
    !['completed', 'cancelled', 'canceled', 'no_show'].includes(session.status);
  const canCancelSession = !['completed', 'cancelled', 'canceled'].includes(session.status);

  const cancelMutation = useMutation({
    mutationFn: () => callFunction('cancel-session', { session_id: session.id }),
    onSuccess: () => {
      setCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
      queryClient.invalidateQueries({ queryKey: ['list-sessions'] });
      onRescheduled?.();
    },
  });

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      await callFunction('start-schedule-session', { schedule_id: session.id });
    },
    onSuccess: () => {
      navigate(sessionWorkspacePath(session.patient!.id, session.id));
    },
  });

  const reminderMutation = useMutation({
    mutationFn: () => {
      if (reminderMode === 'at') {
        const iso = `${reminderDate}T${reminderTime}:00-03:00`;
        return callFunction<{ sent_to: string; contact_name: string; mode: string; send_at?: string }>(
          'send-session-reminder',
          {
            session_id: session.id,
            mode: 'at',
            send_at: new Date(iso).toISOString(),
          },
        );
      }
      return callFunction<{ sent_to: string; contact_name: string; mode: string }>(
        'send-session-reminder',
        {
          session_id: session.id,
          mode: 'now',
        },
      );
    },
    onSuccess: () => {
      setReminderSent(true);
      setReminderPanelOpen(false);
    },
  });

  const canSendReminder =
    !!session.patient &&
    !!contact?.email &&
    !['completed', 'cancelled', 'canceled', 'no_show', 'not_completed'].includes(session.status);

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-sm text-slate-400">{formatTime(session.scheduled_at)}</span>
          <PatientAvatar name={name} fotoUrl={session.patient?.foto_url} size="sm" className="!h-9 !w-9" />
          <span className="min-w-0">
            {session.patient ? (
              <button
                onClick={() => navigate(`/patients/${session.patient!.id}/copilot`)}
                className="block truncate text-sm font-medium text-charcoal transition-colors hover:text-primary"
              >
                {name}
              </button>
            ) : (
              <span className="block truncate text-sm font-medium text-charcoal">{name}</span>
            )}
            <span className="text-xs text-charcoal-muted capitalize">{session.title ?? 'Atendimento'}</span>
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}>{meta.label}</span>
          {session.billing_status === 'PENDENTE_CONFIRMACAO' && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Cobrança pendente
            </span>
          )}
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="mt-3 flex flex-wrap items-center gap-1 pl-[3.25rem]">
        {canStartSession && (
          <button
            type="button"
            onClick={() => startSessionMutation.mutate()}
            disabled={startSessionMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
            </svg>
            {startSessionMutation.isPending ? 'Abrindo...' : 'Iniciar atendimento'}
          </button>
        )}

        <button
          onClick={() => setRescheduling((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-charcoal-muted transition-colors hover:bg-slate-50 hover:text-blue-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Remarcar
        </button>

        {contactLink ? (
          <a
            href={contactLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-charcoal-muted transition-colors hover:bg-slate-50 hover:text-blue-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11 11 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Contato
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-charcoal-muted/40" title="Sem contato cadastrado">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11 11 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Contato
          </span>
        )}

        <button
          type="button"
          onClick={() => setReminderPanelOpen((open) => !open)}
          disabled={!canSendReminder || reminderSent || reminderMutation.isPending}
          title={
            !contact?.email
              ? 'Cadastre e-mail de contato no paciente para enviar lembrete'
              : undefined
          }
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-charcoal-muted transition-colors hover:bg-slate-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-charcoal-muted/40 data-[sent=true]:text-emerald-600"
          data-sent={reminderSent || undefined}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {reminderSent ? 'Lembrete enviado' : 'Enviar lembrete'}
        </button>

        {canCancelSession && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-error/80 transition-colors hover:bg-error-light hover:text-error"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancelar
          </button>
        )}
      </div>

      {reminderPanelOpen && !reminderSent && (
        <div className="mt-3 ml-[3.25rem] space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-medium text-charcoal">Como deseja enviar o lembrete por e-mail?</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setReminderMode('now')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                reminderMode === 'now'
                  ? 'bg-primary text-white'
                  : 'border border-slate-200 bg-white text-charcoal-muted hover:border-primary/30'
              }`}
            >
              Enviar agora
            </button>
            <button
              type="button"
              onClick={() => setReminderMode('at')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                reminderMode === 'at'
                  ? 'bg-primary text-white'
                  : 'border border-slate-200 bg-white text-charcoal-muted hover:border-primary/30'
              }`}
            >
              Agendar horário
            </button>
          </div>

          {reminderMode === 'at' && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-charcoal-muted">
                Data
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="mt-1 block rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-charcoal focus:border-blue-400 focus:outline-none"
                />
              </label>
              <label className="text-xs text-charcoal-muted">
                Horário
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="mt-1 block rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-charcoal focus:border-blue-400 focus:outline-none"
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reminderMutation.mutate()}
              disabled={reminderMutation.isPending}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {reminderMutation.isPending
                ? 'Processando…'
                : reminderMode === 'at'
                  ? 'Agendar lembrete'
                  : 'Confirmar envio'}
            </button>
            <button
              type="button"
              onClick={() => setReminderPanelOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-charcoal-muted hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {reminderMutation.isError && (
        <p className="mt-2 pl-[3.25rem] text-xs text-error">
          {(reminderMutation.error as Error)?.message ?? 'Não foi possível enviar o lembrete.'}
        </p>
      )}

      {startSessionMutation.isError && (
        <p className="mt-2 pl-[3.25rem] text-xs text-error">
          {(startSessionMutation.error as Error)?.message ?? 'Não foi possível iniciar o atendimento.'}
        </p>
      )}

      {/* Remarcar inline */}
      {rescheduling && (
        <div className="mt-3 ml-[3.25rem] rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-charcoal-muted">
              Nova data
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-charcoal focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="text-xs text-charcoal-muted">
              Novo horário
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-charcoal focus:border-blue-400 focus:outline-none"
              />
            </label>
            <button
              onClick={() => rescheduleMutation.mutate()}
              disabled={rescheduleMutation.isPending}
              className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {rescheduleMutation.isPending ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
          {rescheduleMutation.isError && (
            <p className="mt-2 text-xs text-error">
              {(rescheduleMutation.error as Error)?.message ?? 'Não foi possível remarcar.'}
            </p>
          )}
        </div>
      )}

      <StandardModal
        isOpen={cancelOpen}
        onClose={() => {
          if (!cancelMutation.isPending) setCancelOpen(false);
        }}
        title="Cancelar atendimento?"
        size="md"
        closeOnBackdropClick={!cancelMutation.isPending}
        closeOnEscape={!cancelMutation.isPending}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCancelOpen(false)}
              disabled={cancelMutation.isPending}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted hover:bg-white disabled:opacity-50 md:w-auto"
            >
              Voltar
            </button>
            <LoadingButton
              type="button"
              variant="danger"
              loading={cancelMutation.isPending}
              loadingLabel="Cancelando…"
              onClick={() => cancelMutation.mutate()}
              className="h-11 font-semibold md:w-auto"
            >
              Confirmar cancelamento
            </LoadingButton>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-charcoal-muted">
            O atendimento de <span className="font-semibold text-charcoal">{name}</span> às{' '}
            <span className="font-semibold text-charcoal">{formatTime(session.scheduled_at)}</span> será
            removido desta agenda. Paciente e psicólogo receberão um e-mail avisando o cancelamento.
          </p>
          {cancelMutation.isError && (
            <div role="alert" className="rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
              {(cancelMutation.error as Error)?.message ?? 'Não foi possível cancelar o atendimento.'}
            </div>
          )}
        </div>
      </StandardModal>
    </li>
  );
}
