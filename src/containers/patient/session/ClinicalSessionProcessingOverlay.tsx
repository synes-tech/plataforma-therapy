import { Spinner } from '@containers/loading';

interface ClinicalSessionProcessingOverlayProps {
  show: boolean;
  label: string;
  sublabel?: string;
}

export function ClinicalSessionProcessingOverlay({
  show,
  label,
  sublabel = 'Aguarde nesta tela — em instantes você revisará o relatório gerado pela IA.',
}: ClinicalSessionProcessingOverlayProps) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-900/40 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="w-full max-w-md animate-scale-in rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-ai-50 text-ai">
          <Spinner size="lg" />
        </div>
        <p className="mt-5 font-display text-base font-semibold text-charcoal">{label}</p>
        <p className="mt-2 text-sm leading-relaxed text-charcoal-muted">{sublabel}</p>
        <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1.5 w-8 animate-pulse rounded-full bg-primary/30"
              style={{ animationDelay: `${index * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
