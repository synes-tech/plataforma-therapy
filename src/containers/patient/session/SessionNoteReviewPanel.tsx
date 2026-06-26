import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TabPanelLoader } from '@containers/loading';
import { supabase } from '@shared/lib/supabase';
import { SessionNoteApprovalEditor } from './SessionNoteApprovalEditor';
import type { SessionNoteSoapContent } from './session-note-format.utils';

interface SessionNoteRow {
  id: string;
  status: string;
  content: SessionNoteSoapContent;
  ai_generated: boolean;
  created_at: string;
}

interface SessionNoteReviewPanelProps {
  patientId: string;
  scheduleId?: string;
  focusNoteId?: string | null;
  onApproved?: () => void;
}

export function SessionNoteReviewPanel({
  patientId,
  scheduleId,
  focusNoteId,
  onApproved,
}: SessionNoteReviewPanelProps) {
  const queryClient = useQueryClient();
  const focusRef = useRef<HTMLDivElement>(null);

  const { data: notes, isLoading, isFetching } = useQuery({
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
      return data as SessionNoteRow[];
    },
  });

  const orderedNotes = useMemo(() => {
    if (!notes?.length || !focusNoteId) return notes ?? [];
    const focused = notes.find((note) => note.id === focusNoteId);
    if (!focused) return notes;
    return [focused, ...notes.filter((note) => note.id !== focusNoteId)];
  }, [focusNoteId, notes]);

  useEffect(() => {
    function handleJobComplete(event: Event) {
      const detail = (event as CustomEvent<{ patient_id?: string }>).detail;
      if (detail?.patient_id && detail.patient_id !== patientId) return;
      void queryClient.invalidateQueries({ queryKey: ['session-notes-draft', patientId] });
    }

    window.addEventListener('ai-job-complete', handleJobComplete);
    return () => window.removeEventListener('ai-job-complete', handleJobComplete);
  }, [patientId, queryClient]);

  useEffect(() => {
    if (!focusNoteId || isLoading || isFetching) return;
    const hasFocusNote = orderedNotes.some((note) => note.id === focusNoteId);
    if (!hasFocusNote) return;

    const timer = window.setTimeout(() => {
      focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [focusNoteId, isFetching, isLoading, orderedNotes]);

  if (isLoading || (focusNoteId && isFetching && (!notes || notes.length === 0))) {
    return (
      <TabPanelLoader label="Carregando relatório gerado pela IA…" />
    );
  }

  if (!orderedNotes || orderedNotes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 id="session-review-title" className="font-display text-base font-semibold text-charcoal">
          Revisão e aprovação
        </h2>
        <p className="mt-0.5 text-sm text-charcoal-muted">
          {orderedNotes.length} relatório{orderedNotes.length === 1 ? '' : 's'} aguardando salvamento e
          decisão de visibilidade
        </p>
      </header>

      {orderedNotes.map((note) => {
        const isFocused = note.id === focusNoteId;
        return (
          <div
            key={note.id}
            ref={isFocused ? focusRef : undefined}
            className={isFocused ? 'scroll-mt-24' : undefined}
          >
            <SessionNoteApprovalEditor
              noteId={note.id}
              patientId={patientId}
              scheduleId={scheduleId}
              content={note.content}
              createdAt={note.created_at}
              aiGenerated={note.ai_generated}
              highlighted={isFocused}
              onApproved={() => onApproved?.()}
            />
          </div>
        );
      })}
    </div>
  );
}
