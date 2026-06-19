import { Spinner } from './Spinner';

interface PageLoaderProps {
  label?: string;
  minHeight?: 'screen' | 'content';
  className?: string;
}

export function PageLoader({
  label = 'Carregando...',
  minHeight = 'content',
  className = '',
}: PageLoaderProps) {
  const heightClass = minHeight === 'screen' ? 'min-h-dvh' : 'min-h-[50vh]';

  return (
    <div
      className={`flex ${heightClass} flex-col items-center justify-center gap-3 bg-[#F8FAF9] px-4 ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spinner size="lg" />
      <p className="text-sm text-charcoal-muted">{label}</p>
    </div>
  );
}

/** Fallback para React Suspense (lazy routes). */
export function RouteLoadingFallback() {
  return <PageLoader minHeight="screen" label="Abrindo página..." />;
}
