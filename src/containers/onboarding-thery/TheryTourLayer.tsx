import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { TheryAvatar } from '@shared/ui/TheryAvatar';
import type { TheryTourStep } from './thery-tour.types';
import {
  findVisibleTourTarget,
  routeMatchesTour,
  shouldSkipMissingTarget,
  spotlightRectFromElement,
} from './thery-tour.utils';
import { useTheryDialogue } from './useTheryDialogue';

function TheryCaret({ blinking }: { blinking: boolean }) {
  return (
    <span
      className={`ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.12em] bg-charcoal align-baseline ${
        blinking ? 'thery-caret-blink' : ''
      }`}
      aria-hidden
    />
  );
}

interface TheryTourLayerProps {
  step: TheryTourStep;
  stepIndex: number;
  stepCount: number;
  expectedRoute: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onMissing: (stepId: string) => void;
}

interface HoleRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureTarget(step: TheryTourStep, allowFallback: boolean): HTMLElement | null {
  if (step.target) {
    const primary = findVisibleTourTarget(step.target);
    if (primary) return primary;
  }
  if (allowFallback && step.fallbackTarget) return findVisibleTourTarget(step.fallbackTarget);
  return null;
}

export function TheryTourLayer({
  step,
  stepIndex,
  stepCount,
  expectedRoute,
  onNext,
  onBack,
  onSkip,
  onMissing,
}: TheryTourLayerProps) {
  const titleId = useId();
  const bodyId = useId();
  const location = useLocation();
  const [hole, setHole] = useState<HoleRect | null>(null);
  const showSpotlight = step.placement === 'spotlight';
  const routeReady = routeMatchesTour(location.pathname, expectedRoute);

  useEffect(() => {
    if (!routeReady) {
      setHole(null);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let frame = 0;
    let observer: ResizeObserver | null = null;
    let watched: HTMLElement | null = null;

    function attach(el: HTMLElement) {
      observer?.disconnect();
      watched = el;
      observer = new ResizeObserver(() => {
        if (!cancelled) setHole(spotlightRectFromElement(el));
      });
      observer.observe(el);
      setHole(spotlightRectFromElement(el));
    }

    function sync() {
      if (cancelled) return;
      const allowFallback = attempts >= 8;
      const el = measureTarget(step, allowFallback);
      if (el) {
        attach(el);
        return;
      }
      setHole(null);
      attempts += 1;
      if (attempts >= 20) {
        if (shouldSkipMissingTarget(step)) onMissing(step.id);
        return;
      }
      window.setTimeout(() => {
        frame = window.requestAnimationFrame(sync);
      }, 80);
    }

    frame = window.requestAnimationFrame(sync);
    const refresh = () => {
      const el = measureTarget(step, true) ?? watched;
      if (el) setHole(spotlightRectFromElement(el));
    };
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [step, onMissing, routeReady]);

  const isLast = stepIndex >= stepCount - 1;
  const progress = `${stepIndex + 1} de ${stepCount}`;
  const { frame, skip } = useTheryDialogue(step.title, step.body, step.id);

  function handleAdvance() {
    if (!frame.done) {
      skip();
      return;
    }
    onNext();
  }

  const bubble = (
    <div className="w-full rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-2xl lg:w-[min(32rem,46vw)] lg:min-w-[24rem] lg:shrink-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-charcoal-muted/70">{progress}</p>
      <h2 id={titleId} className="sr-only">
        {step.title}
      </h2>
      <p id={bodyId} className="sr-only">
        {step.body}
      </p>
      <button
        type="button"
        className="mt-1 w-full cursor-text select-none text-left"
        onClick={() => {
          if (!frame.done) skip();
        }}
        aria-hidden
        tabIndex={-1}
      >
        <span className="grid">
          <span
            className="invisible col-start-1 row-start-1 font-serif text-lg font-medium tracking-tight text-charcoal sm:text-xl"
            aria-hidden
          >
            {step.title}
          </span>
          <span className="col-start-1 row-start-1 font-serif text-lg font-medium tracking-tight text-charcoal sm:text-xl">
            {frame.title}
            {frame.caret === 'title' ? <TheryCaret blinking={false} /> : null}
          </span>
        </span>
        <span className="mt-2 grid">
          <span className="invisible col-start-1 row-start-1 text-sm leading-relaxed text-charcoal-muted sm:text-[15px]" aria-hidden>
            {step.body}
          </span>
          <span className="col-start-1 row-start-1 text-sm leading-relaxed text-charcoal-muted sm:text-[15px]">
            {frame.body}
            {frame.caret === 'body' ? <TheryCaret blinking={frame.done} /> : null}
          </span>
        </span>
      </button>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="h-10 rounded-xl px-3 text-sm font-medium text-charcoal-muted hover:bg-slate-50"
        >
          Pular tutorial
        </button>
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={onBack}
            className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-charcoal"
          >
            Voltar
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNext}
          className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          {step.ctaLabel ?? (isLast ? 'Concluir' : 'Próximo')}
        </button>
      </div>
    </div>
  );

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[45]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
    >
      {showSpotlight && hole ? (
        <>
          <div
            className="pointer-events-none fixed rounded-2xl"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45)',
            }}
            aria-hidden
          />
          <button
            type="button"
            className="pointer-events-auto fixed inset-x-0 top-0 bg-transparent"
            style={{ height: Math.max(0, hole.top) }}
            aria-label="Avançar tutorial"
            onClick={handleAdvance}
          />
          <button
            type="button"
            className="pointer-events-auto fixed left-0 bg-transparent"
            style={{ top: hole.top, width: Math.max(0, hole.left), height: hole.height }}
            aria-label="Avançar tutorial"
            onClick={handleAdvance}
          />
          <button
            type="button"
            className="pointer-events-auto fixed bg-transparent"
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              right: 0,
              height: hole.height,
            }}
            aria-label="Avançar tutorial"
            onClick={handleAdvance}
          />
          <button
            type="button"
            className="pointer-events-auto fixed inset-x-0 bottom-0 bg-transparent"
            style={{ top: hole.top + hole.height }}
            aria-label="Avançar tutorial"
            onClick={handleAdvance}
          />
          <div
            className="pointer-events-none fixed rounded-2xl ring-2 ring-primary ring-offset-2 ring-offset-transparent"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
          />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-slate-900/35" onClick={handleAdvance} aria-hidden />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center px-3 lg:flex-row lg:items-end lg:justify-center lg:gap-6 lg:px-8">
        <div className="pointer-events-auto order-1 mb-3 w-full max-w-md lg:order-2 lg:mb-8 lg:w-auto">
          {bubble}
        </div>
        <TheryAvatar
          pose={step.pose}
          size="tour"
          variant="figure"
          decorative
          className="order-2 origin-bottom lg:order-1"
        />
      </div>
    </div>,
    document.body,
  );
}
