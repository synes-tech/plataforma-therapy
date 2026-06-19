import { Spinner } from './Spinner';
import { SkeletonBlock } from './Skeleton';

const COLUMNS = ['Paciente', 'Idade', 'Diagnósticos', 'Status', 'Ações'];

interface PatientListTableSkeletonProps {
  rows?: number;
  label?: string;
}

/** Skeleton da tabela de pacientes ativos (desktop + mobile + spinner). */
export function PatientListTableSkeleton({
  rows = 8,
  label = 'Carregando pacientes...',
}: PatientListTableSkeletonProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
      aria-busy="true"
      aria-live="polite"
      role="status"
      aria-label={label}
    >
      <div className="border-b border-slate-100 px-4 py-2.5 sm:px-5">
        <SkeletonBlock className="h-4 w-36" />
      </div>

      {/* Desktop */}
      <div className="relative hidden md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
              {COLUMNS.map((col) => (
                <th key={col} className="px-5 py-3 font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
                    <SkeletonBlock className="h-4 w-40" />
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <SkeletonBlock className="h-4 w-12" />
                </td>
                <td className="px-5 py-3.5">
                  <SkeletonBlock className="h-6 w-48" />
                </td>
                <td className="px-5 py-3.5">
                  <SkeletonBlock className="h-6 w-20 rounded-full" />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <SkeletonBlock className="ml-auto h-9 w-24 rounded-lg" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="relative divide-y divide-slate-100 md:hidden">
        {Array.from({ length: Math.min(rows, 5) }).map((_, i) => (
          <div key={i} className="space-y-3 px-4 py-4">
            <div className="flex items-start gap-3">
              <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-36" />
                <SkeletonBlock className="h-3 w-16" />
              </div>
              <SkeletonBlock className="h-6 w-16 rounded-full" />
            </div>
            <SkeletonBlock className="h-6 w-44" />
            <SkeletonBlock className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 backdrop-blur-[1px]">
        <Spinner size="md" />
        <p className="text-xs font-medium text-charcoal-muted">{label}</p>
      </div>
    </div>
  );
}
