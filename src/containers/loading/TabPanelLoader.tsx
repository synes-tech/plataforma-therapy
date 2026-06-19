import { Spinner } from './Spinner';

interface TabPanelLoaderProps {
  label?: string;
  className?: string;
}

/** Loader para painéis de aba (prontuário, billing, etc.). */
export function TabPanelLoader({
  label = 'Carregando...',
  className = '',
}: TabPanelLoaderProps) {
  return (
    <div
      className={`flex min-h-[20rem] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-white shadow-sm ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner size="md" />
      <p className="text-sm text-charcoal-muted">{label}</p>
    </div>
  );
}

interface LoadingOverlayProps {
  show: boolean;
  label?: string;
}

/** Overlay semitransparente para refetch (troca de mês, filtros, etc.). */
export function LoadingOverlay({ show, label }: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/75 backdrop-blur-[1px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner size="md" />
      {label ? <p className="text-xs text-charcoal-muted">{label}</p> : null}
    </div>
  );
}

/** Barra fina no topo durante navegação entre rotas. */
export function NavigationLoadingBar({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-primary/20"
      role="status"
      aria-live="polite"
      aria-label="Carregando página"
    >
      <div className="h-full w-1/3 animate-pulse bg-primary" />
    </div>
  );
}
