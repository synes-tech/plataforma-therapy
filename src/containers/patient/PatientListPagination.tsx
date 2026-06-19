interface PatientListPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
}

export function PatientListPagination({
  page,
  totalPages,
  total,
  start,
  end,
  onPageChange,
}: PatientListPaginationProps) {
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-charcoal-muted">
        Mostrando <span className="font-medium text-charcoal">{start}–{end}</span> de{' '}
        <span className="font-medium text-charcoal">{total}</span> pacientes
      </p>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>

          <span className="min-w-[7rem] text-center text-xs text-charcoal-muted">
            Página {page} de {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
