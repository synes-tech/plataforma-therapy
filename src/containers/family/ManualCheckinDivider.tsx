export function ManualCheckinDivider() {
  return (
    <div
      className="relative my-6 flex w-full items-center gap-4 sm:my-8"
      role="separator"
      aria-label="ou preencha manualmente"
    >
      <div className="h-px flex-1 bg-slate-200" aria-hidden />
      <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-charcoal-muted">
        ou preencha manualmente
      </span>
      <div className="h-px flex-1 bg-slate-200" aria-hidden />
    </div>
  );
}
