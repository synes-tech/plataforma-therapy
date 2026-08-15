import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingButton } from '@containers/loading';
import {
  getReportSectionValue,
  PSYCH_REPORT_SECTIONS,
  type SessionReportContentFields,
} from '@containers/patient/session/session-report-sections';
import { supabase } from '@shared/lib/supabase';
import { useAuthStore } from '@shared/lib/auth-store';

interface SessionNote {
  id: string;
  status: string;
  content: SessionReportContentFields;
  ai_generated: boolean;
  created_at: string;
}

interface SessionNoteReviewProps {
  patientId: string;
}

export function SessionNoteReview({ patientId }: SessionNoteReviewProps) {
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['session-notes-draft', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session_notes')
        .select('id, status, content, ai_generated, created_at')
        .eq('patient_id', patientId)
        .eq('status', 'draft')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data as SessionNote[];
    },
  });

  useEffect(() => {
    function handleJobComplete(event: Event) {
      const detail = (event as CustomEvent<{ patient_id?: string }>).detail;
      if (detail?.patient_id && detail.patient_id !== patientId) return;
      void queryClient.invalidateQueries({ queryKey: ['session-notes-draft', patientId] });
    }

    window.addEventListener('ai-job-complete', handleJobComplete);
    return () => window.removeEventListener('ai-job-complete', handleJobComplete);
  }, [patientId, queryClient]);

  if (isLoading) {
    return null;
  }

  if (!notes || notes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 id="session-review-title" className="font-display text-base font-semibold text-charcoal">
          Pendentes de revisão
        </h2>
        <p className="mt-0.5 text-sm text-charcoal-muted">
          {notes.length} relatório{notes.length === 1 ? '' : 's'} aguardando sua aprovação
        </p>
      </header>

      {notes.map((note) => (
        <NoteCard key={note.id} note={note} patientId={patientId} />
      ))}
    </div>
  );
}

function NoteCard({ note, patientId }: { note: SessionNote; patientId: string }) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const synthesis = getReportSectionValue(note.content, PSYCH_REPORT_SECTIONS[0]);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('session_notes')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: useAuthStore.getState().user?.id,
        })
        .eq('id', note.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-notes-draft', patientId] });
    },
  });

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {note.ai_generated && (
            <span className="inline-flex rounded-full bg-ai-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ai">
              IA
            </span>
          )}
          <time className="text-xs text-charcoal-muted" dateTime={note.created_at}>
            {new Date(note.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="shrink-0 text-xs font-medium text-primary transition-colors hover:text-primary-dark"
        >
          {isExpanded ? 'Recolher' : 'Ver completo'}
        </button>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <p className="text-xs font-medium uppercase tracking-wide text-charcoal-muted">
          {PSYCH_REPORT_SECTIONS[0].label}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-charcoal line-clamp-3">
          {synthesis || 'Relatório gerado — abra para revisar os blocos clínicos.'}
        </p>
      </div>

      {isExpanded && (
        <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:px-5">
          {PSYCH_REPORT_SECTIONS.slice(1).map((section) => (
            <ReportSection
              key={section.key}
              label={section.label}
              content={getReportSectionValue(note.content, section)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:px-5">
        <LoadingButton
          type="button"
          variant="primary"
          fullWidth
          loading={approveMutation.isPending}
          loadingLabel="Aprovando..."
          onClick={() => approveMutation.mutate()}
          className="h-10 text-sm font-semibold"
        >
          Aprovar relatório
        </LoadingButton>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-charcoal-muted transition-colors hover:border-charcoal/20 hover:text-charcoal"
        >
          Editar
        </button>
      </div>
    </article>
  );
}

function ReportSection({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-charcoal-muted">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-charcoal">
        {content || 'Não relatado nesta sessão.'}
      </p>
    </div>
  );
}
