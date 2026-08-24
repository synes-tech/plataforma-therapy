import { useEffect, useRef, useState } from 'react';
import { FEATURES } from './landing-content';
import { LandingIconMark } from './landing-icons';
import { Reveal } from './landing-reveal';
import { ShowcasePanel } from './landing-showcase-panels';
import {
  nextShowcaseIndex,
  previousShowcaseIndex,
  shouldAlignActiveShowcaseTab,
  shouldScrollToShowcaseOnCardClick,
  showcaseCounter,
  showcaseScrollBehavior,
  showcaseTabScrollLeft,
  swipeIntent,
} from './landing-showcase.utils';
import './landing-showcase.css';

const AUTOPLAY_MS = 9000;

export function FeatureShowcase() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const demoRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const active = FEATURES[index] ?? FEATURES[0]!;

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setTimeout(() => {
      setIndex((current) => nextShowcaseIndex(current, FEATURES.length));
    }, AUTOPLAY_MS);

    return () => window.clearTimeout(timer);
  }, [index, paused]);

  useEffect(() => {
    const scroller = tabsRef.current;
    const tab = scroller?.querySelector<HTMLElement>(`#showcase-tab-${active.id}`);
    if (!scroller || !tab) return;
    if (!shouldAlignActiveShowcaseTab(window.innerWidth)) return;

    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    const tabBox = tab.getBoundingClientRect();
    const scrollerBox = scroller.getBoundingClientRect();
    const nextLeft = showcaseTabScrollLeft(
      tabBox.left,
      scrollerBox.left,
      scroller.scrollLeft,
      maxScroll,
    );
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    scroller.scrollTo({
      left: nextLeft,
      behavior: showcaseScrollBehavior(prefersReduced),
    });
  }, [index, active.id]);

  function goTo(next: number) {
    setPaused(true);
    setIndex(next);
  }

  function scrollDemoIntoView() {
    if (!shouldScrollToShowcaseOnCardClick(window.innerWidth)) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    demoRef.current?.scrollIntoView({
      behavior: showcaseScrollBehavior(prefersReduced),
      block: 'start',
    });
  }

  function selectFromCard(next: number) {
    goTo(next);
    scrollDemoIntoView();
  }

  function goNext() {
    goTo(nextShowcaseIndex(index, FEATURES.length));
  }

  function goPrevious() {
    goTo(previousShowcaseIndex(index, FEATURES.length));
  }

  return (
    <>
      <Reveal from="left" className="mt-7 flex justify-center">
        <p className="landing-topic-hint">
          <span className="landing-topic-hint-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 3.5l6.5 15 1.8-5.2 5.2-1.8L9 3.5zM6 3v2M3 6h2M4.2 10.2l1.4-1.4"
              />
            </svg>
          </span>
          Clique em cima das funcionalidades e veja detalhes
        </p>
      </Reveal>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-2">
        {[FEATURES.slice(0, 4), FEATURES.slice(4, 8)].map((group, groupIndex) => (
          <Reveal
            key={groupIndex}
            from={groupIndex === 0 ? 'left' : 'right'}
            delayMs={groupIndex * 90}
            className="h-full"
          >
            <div className="landing-topic-grid">
              {group.map((feature) => {
                const position = FEATURES.indexOf(feature);
                return (
                  <button
                    key={feature.id}
                    type="button"
                    onClick={() => selectFromCard(position)}
                    aria-pressed={position === index}
                    className={`landing-topic-card${position === index ? ' is-on' : ''}`}
                  >
                    <span className="landing-topic-icon">
                      <LandingIconMark icon={feature.icon} className="h-4 w-4" />
                    </span>
                    <span className="landing-topic-title mt-2.5 block font-display text-[13px] font-semibold leading-snug">
                      {feature.title}
                    </span>
                    <span className="landing-topic-text mt-1 block text-[11px] leading-snug">
                      {feature.short}
                    </span>
                  </button>
                );
              })}
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal from="left" className="mt-10">
        <section
          ref={demoRef}
          id="showcase-demo"
          className="landing-show-carousel"
          aria-roledescription="carrossel"
          aria-label="Funcionalidades em detalhe"
          tabIndex={0}
          onFocus={() => setPaused(true)}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              goNext();
            }
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              goPrevious();
            }
          }}
          onPointerDown={(event) => {
            dragStartX.current = event.clientX;
          }}
          onPointerUp={(event) => {
            if (dragStartX.current === null) return;
            const intent = swipeIntent(event.clientX - dragStartX.current);
            dragStartX.current = null;
            if (intent === 'next') goNext();
            if (intent === 'previous') goPrevious();
          }}
        >
          <header className="landing-show-header">
            <div
              ref={tabsRef}
              className="landing-show-tabs"
              role="tablist"
              aria-label="Escolher funcionalidade"
            >
              {FEATURES.map((feature, position) => (
                <button
                  key={feature.id}
                  type="button"
                  role="tab"
                  id={`showcase-tab-${feature.id}`}
                  aria-selected={position === index}
                  aria-controls="showcase-panel"
                  onClick={() => goTo(position)}
                  className={`landing-show-tab${position === index ? ' is-on' : ''}`}
                >
                  <LandingIconMark icon={feature.icon} className="h-3.5 w-3.5" />
                  {feature.title}
                </button>
              ))}
            </div>

            <div className="landing-show-nav">
              <span className="landing-show-counter">{showcaseCounter(index, FEATURES.length)}</span>
              <button type="button" onClick={goPrevious} className="landing-show-arrow" aria-label="Funcionalidade anterior">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button type="button" onClick={goNext} className="landing-show-arrow" aria-label="Próxima funcionalidade">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </header>

          <div
            className="landing-show-slide"
            key={active.id}
            id="showcase-panel"
            role="tabpanel"
            aria-labelledby={`showcase-tab-${active.id}`}
          >
            <div className="landing-show-copy">
              <p className="landing-show-eyebrow">{active.eyebrow}</p>
              <h3 className="mt-3 font-serif text-[1.7rem] font-medium leading-tight tracking-tight text-charcoal sm:text-[2.05rem]">
                {active.title}
              </h3>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-charcoal-muted">{active.description}</p>
              <ul className="mt-6 space-y-3">
                {active.points.map((point) => (
                  <li key={point} className="flex gap-2.5 text-sm leading-snug text-charcoal">
                    <LandingIconMark icon="check" className="mt-0.5 h-4 w-4 shrink-0 text-mint-dark" />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="landing-show-hint">
                Toque no painel para interagir · arraste ou use as setas para navegar
              </p>
            </div>

            <div className="landing-show-panel">
              <span className="landing-show-glow" aria-hidden />
              <ShowcasePanel id={active.id} />
            </div>
          </div>

          <footer className="landing-show-footer">
            {FEATURES.map((feature, position) => (
              <button
                key={feature.id}
                type="button"
                onClick={() => goTo(position)}
                aria-label={`Ir para ${feature.title}`}
                aria-current={position === index}
                className={`landing-show-dot${position === index ? ' is-on' : ''}`}
              >
                <span
                  className={`landing-show-dot-fill${position === index && !paused ? ' is-running' : ''}`}
                  style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
                />
              </button>
            ))}
          </footer>
        </section>
      </Reveal>
    </>
  );
}
