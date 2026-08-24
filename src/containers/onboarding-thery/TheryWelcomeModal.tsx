import { StandardModal } from '@shared/ui/StandardModal';
import { TheryAvatar } from '@shared/ui/TheryAvatar';
import type { TheryTourAudience } from './thery-tour.types';
import { welcomeCopy } from './thery-tour.utils';

interface TheryWelcomeModalProps {
  isOpen: boolean;
  audience: TheryTourAudience;
  firstName: string;
  onStart: () => void;
  onSkip: () => void;
}

export function TheryWelcomeModal({
  isOpen,
  audience,
  firstName,
  onStart,
  onSkip,
}: TheryWelcomeModalProps) {
  const copy = welcomeCopy(audience, firstName);

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onSkip}
      title={copy.title}
      size="md"
      closeOnBackdropClick={false}
      footer={
        <>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal-muted md:w-auto"
          >
            Pular
          </button>
          <button
            type="button"
            onClick={onStart}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark md:w-auto"
          >
            Iniciar tutorial
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center">
        <TheryAvatar pose="happy" size="hero" variant="figure" decorative />
        <p className="mt-5 text-sm leading-relaxed text-charcoal-muted">{copy.body}</p>
      </div>
    </StandardModal>
  );
}
