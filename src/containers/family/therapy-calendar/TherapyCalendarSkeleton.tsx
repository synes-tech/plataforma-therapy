export function TherapyCalendarSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-4 sm:p-5" aria-hidden>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`h-${i}`} className="mx-auto h-3 w-6 rounded bg-slate-100" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
