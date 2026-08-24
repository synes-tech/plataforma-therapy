import { TheryAvatar } from '@shared/ui/TheryAvatar';
import { ivyConfettiPieces } from './ivy-welcome.utils';
import './ivy-welcome.css';

interface IvyWelcomeHeroProps {
  bursting: boolean;
  runId: number;
  onReplay: () => void;
}

export function IvyWelcomeHero({ bursting, runId, onReplay }: IvyWelcomeHeroProps) {
  const pieces = ivyConfettiPieces();

  return (
    <div className="ivy-welcome-stage">
      <div className={`ivy-confetti ${bursting ? 'is-burst' : ''}`} aria-hidden>
        {pieces.map((piece) => (
          <span
            key={`${runId}-${piece.id}`}
            className="ivy-confetti-piece"
            style={{
              left: piece.left,
              backgroundColor: piece.color,
              borderRadius: piece.radius,
              animationDelay: bursting ? piece.delay : undefined,
              animationDuration: bursting ? piece.duration : undefined,
              ['--ivy-dx' as string]: piece.dx,
              ['--ivy-dy' as string]: piece.dy,
              ['--ivy-rot' as string]: piece.rotate,
            }}
          />
        ))}
      </div>
      <button
        type="button"
        key={runId}
        onClick={onReplay}
        className={`ivy-welcome-figure ${bursting ? 'is-pop' : ''}`}
        aria-label="Ver apresentação da Ivy"
        title="Ver apresentação da Ivy"
      >
        <TheryAvatar pose="happy" variant="figure" size="lg" decorative />
      </button>
    </div>
  );
}
