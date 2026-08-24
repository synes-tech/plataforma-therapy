import { TheryAvatar } from '@shared/ui/TheryAvatar';
import { useTheryTourOptional } from './thery-tour-context';

export function TheryReplayCard() {
  const tour = useTheryTourOptional();
  if (!tour?.audience) return null;

  return (
    <section className="mb-6 rounded-2xl border border-primary/15 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <TheryAvatar pose="happy" size="md" variant="figure" decorative className="hidden sm:block" />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg font-medium tracking-tight text-charcoal">Tutorial da Ivy</p>
          <p className="mt-1 text-sm leading-relaxed text-charcoal-muted">
            Quer que eu mostre de novo o caminho da plataforma? Leva só alguns minutos.
          </p>
          <button
            type="button"
            onClick={tour.replay}
            className="mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
          >
            Ver o tutorial da Ivy de novo
          </button>
        </div>
      </div>
    </section>
  );
}
