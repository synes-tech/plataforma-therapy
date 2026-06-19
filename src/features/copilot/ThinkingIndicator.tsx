import { useEffect, useState } from 'react';

const THINKING_PHASES = [
  'Pensando',
  'Analisando contexto clínico',
  'Buscando histórico relevante',
  'Formando resposta',
];

/**
 * ThinkingIndicator — animação de "IA pensando" com textos rotativos.
 *
 * Exibe frases que rotacionam a cada ~2.5s com fade in/out suave,
 * acompanhadas de um shimmer e dots animados para feedback visual premium.
 */
export function ThinkingIndicator() {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setPhaseIndex((prev) => (prev + 1) % THINKING_PHASES.length);
        setFading(false);
      }, 300);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 py-1">
      {/* Animated orb */}
      <div className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute h-5 w-5 animate-ping rounded-full bg-indigo-400/20" />
        <span className="relative h-2.5 w-2.5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 shadow-sm" />
      </div>

      {/* Rotating text */}
      <span
        className={`text-sm text-indigo-600/80 transition-opacity duration-300 ${
          fading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {THINKING_PHASES[phaseIndex]}
      </span>

      {/* Animated dots */}
      <span className="flex gap-0.5">
        <span
          className="h-1 w-1 rounded-full bg-indigo-400 animate-bounce"
          style={{ animationDuration: '1s', animationDelay: '0ms' }}
        />
        <span
          className="h-1 w-1 rounded-full bg-indigo-400 animate-bounce"
          style={{ animationDuration: '1s', animationDelay: '200ms' }}
        />
        <span
          className="h-1 w-1 rounded-full bg-indigo-400 animate-bounce"
          style={{ animationDuration: '1s', animationDelay: '400ms' }}
        />
      </span>
    </div>
  );
}
