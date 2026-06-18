interface SessionNote {
  id: string;
  status: string;
  content: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  ai_generated: boolean;
  approved_at: string | null;
  created_at: string;
}

interface Props {
  notes: SessionNote[];
  totalSessions: number;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  approved: { label: 'Aprovado', className: 'bg-mint-50 text-mint-dark' },
  draft: { label: 'Rascunho', className: 'bg-slate-100 text-charcoal-muted' },
  archived: { label: 'Arquivado', className: 'bg-slate-50 text-charcoal-muted/60' },
};

export function SessionTimeline({ notes, totalSessions }: Props) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
          Histórico de Sessões
        </h3>
        <span className="text-[11px] text-charcoal-muted/60">{totalSessions} total</span>
      </div>

      <div className="space-y-4">
        {notes.map((note, idx) => {
          const badge = STATUS_BADGE[note.status] ?? STATUS_BADGE.draft;
          const date = new Date(note.created_at);

          return (
            <div key={note.id} className="relative flex gap-3">
              {/* Timeline line */}
              {idx < notes.length - 1 && (
                <div className="absolute left-[7px] top-6 h-[calc(100%+0.5rem)] w-px bg-slate-100" />
              )}

              {/* Dot */}
              <div className="relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary/30 bg-white" />

              {/* Content */}
              <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50/30 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-charcoal">
                    {date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${badge?.className ?? 'bg-slate-100 text-charcoal-muted'}`}>
                    {badge?.label ?? note.status}
                  </span>
                  {note.ai_generated && (
                    <span className="rounded-full bg-ai-50 px-2 py-0.5 text-[9px] font-medium text-ai">
                      IA
                    </span>
                  )}
                </div>

                {/* SOAP preview */}
                <div className="mt-2 space-y-1.5">
                  {note.content.assessment && (
                    <p className="text-xs text-charcoal-muted">
                      <span className="font-medium text-charcoal">A: </span>
                      {note.content.assessment.slice(0, 150)}
                      {note.content.assessment.length > 150 && '...'}
                    </p>
                  )}
                  {note.content.plan && (
                    <p className="text-xs text-charcoal-muted">
                      <span className="font-medium text-charcoal">P: </span>
                      {note.content.plan.slice(0, 120)}
                      {note.content.plan.length > 120 && '...'}
                    </p>
                  )}
                  {!note.content.assessment && !note.content.plan && note.content.subjective && (
                    <p className="text-xs text-charcoal-muted">
                      <span className="font-medium text-charcoal">S: </span>
                      {note.content.subjective.slice(0, 150)}
                      {note.content.subjective.length > 150 && '...'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
