import { TheryAvatar } from '@shared/ui/TheryAvatar';
import { ivyConfettiPieces } from '@containers/copilot-workspace/ivy-welcome.utils';
import '@containers/copilot-workspace/ivy-welcome.css';
import './checkout-celebration.css';
import { checkoutCelebrationCopy } from './checkout-celebration.copy';

interface CheckoutCelebrationProps {
  planLabel: string;
  isTrial: boolean;
  chargeAtIso: string | null;
  trialDays?: number;
  continueLabel?: string;
  onContinue: () => void;
}

export function CheckoutCelebration({
  planLabel,
  isTrial,
  chargeAtIso,
  trialDays,
  continueLabel = 'Começar a usar',
  onContinue,
}: CheckoutCelebrationProps) {
  const copy = checkoutCelebrationCopy({ planLabel, isTrial, chargeAtIso, trialDays });
  const pieces = ivyConfettiPieces();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F8FAF9] px-4 py-10">
      <div className="w-full max-w-lg text-center">
        <div className="ivy-welcome-stage checkout-celebration-stage">
          <div className="ivy-confetti is-burst" aria-hidden>
            {pieces.map((piece) => (
              <span
                key={piece.id}
                className="ivy-confetti-piece"
                style={{
                  left: piece.left,
                  backgroundColor: piece.color,
                  borderRadius: piece.radius,
                  animationDelay: piece.delay,
                  animationDuration: piece.duration,
                  ['--ivy-dx' as string]: piece.dx,
                  ['--ivy-dy' as string]: piece.dy,
                  ['--ivy-rot' as string]: piece.rotate,
                }}
              />
            ))}
          </div>
          <div className="ivy-welcome-figure checkout-celebration-ivy is-pop">
            <TheryAvatar pose="happy" variant="figure" size="welcome" decorative />
          </div>
        </div>

        <h1 className="mt-6 font-serif text-3xl leading-tight text-charcoal sm:text-[2.15rem]">
          {copy.title}
        </h1>
        <p className="mt-3 text-base text-slate-600">{copy.subtitle}</p>
        {copy.planLine ? (
          <p className="mt-2 text-lg font-semibold text-primary">{copy.planLine}</p>
        ) : null}
        {copy.warning ? (
          <p className="mx-auto mt-5 max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
            {copy.warning}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onContinue}
          className="mt-8 inline-flex h-12 w-full max-w-sm items-center justify-center rounded-xl bg-primary text-sm font-semibold text-white hover:bg-primary-dark"
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
