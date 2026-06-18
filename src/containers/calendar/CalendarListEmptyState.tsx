interface CalendarListEmptyStateProps {
  onNewSchedule: () => void;
}

function FreeAgendaIllustration() {
  return (
    <svg className="h-16 w-16 text-slate-300" viewBox="0 0 80 80" fill="none" aria-hidden>
      <rect x="16" y="20" width="36" height="44" rx="6" stroke="currentColor" strokeWidth="2" />
      <path d="M26 16h16M34 12v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 36h20M24 44h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
      <circle cx="58" cy="52" r="14" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      <path d="M52 52l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

export function CalendarListEmptyState({ onNewSchedule }: CalendarListEmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-200/80 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-slate-50">
        <FreeAgendaIllustration />
      </div>
      <h2 className="font-serif text-xl font-medium text-charcoal">Agenda livre</h2>
      <p className="mt-2 max-w-sm text-sm text-charcoal-muted">
        Nenhum atendimento nos próximos 30 dias. Aproveite para planejar ou agende o primeiro horário.
      </p>
      <button
        type="button"
        onClick={onNewSchedule}
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Realizar agendamento
      </button>
    </div>
  );
}
