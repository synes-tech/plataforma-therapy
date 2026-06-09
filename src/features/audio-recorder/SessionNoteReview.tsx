import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';

interface SessionNote {
  id: string;
  status: string;
  content: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  ai_generated: boolean;
  created_at: string;
}

interface SessionNoteReviewProps {
  patientId: string;
}

export function SessionNoteReview({ patientId }: SessionNoteReviewProps) {

  // Fetch latest draft notes for this patient
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="shimmer h-32 rounded-lg" />
      </div>
    );
  }

  if (!notes || notes.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-sm text-text-muted">Nenhum relatório pendente de revisão</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-ai-light">
        Relatórios pendentes de aprovação ({notes.length})
      </h3>
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} patientId={patientId} />
      ))}
    </div>
  );
}

function NoteCard({ note, patientId }: { note: SessionNote; patientId: string }) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('session_notes')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', note.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-notes-draft', patientId] });
    },
  });

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {note.ai_generated && (
            <span className="rounded-full bg-ai/20 px-2 py-0.5 text-[10px] font-medium text-ai-light">
              IA
            </span>
          )}
          <span className="text-xs text-text-muted">
            {new Date(note.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-primary hover:text-primary-light"
        >
          {isExpanded ? 'Recolher' : 'Expandir'}
        </button>
      </div>

      {/* Preview (always visible) */}
      <div className="border-t border-surface-border px-4 py-3">
        <p className="text-xs text-text-muted">Subjetivo:</p>
        <p className="mt-1 text-sm text-text line-clamp-2">
          {note.content.subjective}
        </p>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="space-y-3 border-t border-surface-border px-4 py-3">
          <SOAPSection label="Objetivo" content={note.content.objective} />
          <SOAPSection label="Avaliação" content={note.content.assessment} />
          <SOAPSection label="Plano" content={note.content.plan} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 border-t border-surface-border px-4 py-3">
        <button
          onClick={() => approveMutation.mutate()}
          disabled={approveMutation.isPending}
          className="flex-1 rounded-lg bg-success/20 py-2 text-xs font-medium text-success hover:bg-success/30 disabled:opacity-50"
        >
          {approveMutation.isPending ? 'Aprovando...' : '✓ Aprovar Relatório'}
        </button>
        <button className="rounded-lg bg-surface-card px-4 py-2 text-xs text-text-muted hover:bg-surface-light">
          Editar
        </button>
      </div>
    </div>
  );
}

function SOAPSection({ label, content }: { label: string; content: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-primary-light">{label}:</p>
      <p className="mt-1 text-sm text-text">{content}</p>
    </div>
  );
}
