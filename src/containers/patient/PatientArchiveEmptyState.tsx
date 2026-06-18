export function PatientArchiveEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-gray-50 px-6 py-16 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <svg
          className="h-9 w-9 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.25}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-600">Nenhum histórico arquivado.</p>
      <p className="mt-2 max-w-sm mx-auto text-sm text-gray-500">
        Pacientes desvinculados aparecerão aqui.
      </p>
    </div>
  );
}
