function FolderEmptyIcon() {
  return (
    <svg
      className="h-10 w-10 text-slate-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}

interface PatientArtifactsEmptyStateProps {
  filtered?: boolean;
}

export function PatientArtifactsEmptyState({ filtered = false }: PatientArtifactsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-transparent px-6 py-14 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50">
        <FolderEmptyIcon />
      </div>
      <p className="font-display text-base font-medium text-charcoal">
        {filtered ? 'Nenhum documento neste filtro' : 'Pasta vazia'}
      </p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-charcoal-muted">
        Nenhum documento salvo aqui. Interaja com o Copiloto e salve respostas importantes para
        preencher este espaço.
      </p>
    </div>
  );
}
