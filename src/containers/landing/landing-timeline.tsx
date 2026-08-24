import { useEffect, useState } from 'react';
import { TIMELINE_DECISION, TIMELINE_INSIGHT, TIMELINE_PREVIEW } from './landing-content';
import { LandingIconMark } from './landing-icons';
import './landing-motion.css';

const ITEM_COUNT = TIMELINE_PREVIEW.length;
const INSIGHT_STEP = ITEM_COUNT + 1;
const DECISION_STEP = ITEM_COUNT + 2;

function phaseDuration(step: number): number {
  if (step === 0) return 1400;
  if (step === INSIGHT_STEP) return 2400;
  if (step === DECISION_STEP) return 4000;
  return 1650;
}

export function nextTimelineStep(step: number): number {
  return step >= DECISION_STEP ? 0 : step + 1;
}

export function isTimelineInsightAwake(step: number): boolean {
  return step === INSIGHT_STEP;
}

export function isTimelineDecisionAwake(step: number): boolean {
  return step >= DECISION_STEP;
}

export function HeroTimelineCard() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(DECISION_STEP);
      return;
    }

    let current = 0;
    let timer = window.setTimeout(function tick() {
      current = nextTimelineStep(current);
      setStep(current);
      timer = window.setTimeout(tick, phaseDuration(current));
    }, phaseDuration(0));

    return () => window.clearTimeout(timer);
  }, []);

  const insightAwake = isTimelineInsightAwake(step);
  const decisionAwake = isTimelineDecisionAwake(step);

  return (
    <div className="rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-6">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex items-center gap-2.5 rounded-2xl bg-primary-50/70 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-sm">
            <LandingIconMark icon="mic" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-charcoal">Ditado pós-sessão</p>
            <p className="text-[11px] text-charcoal-muted">Relatório gerado em 12s</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl bg-mint-50 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-mint-dark shadow-sm">
            <LandingIconMark icon="trend" className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-charcoal">+38% engajamento</p>
            <p className="text-[11px] text-charcoal-muted">Famílias ativas / mês</p>
          </div>
        </div>
      </div>

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-charcoal-muted">
        Jornada da semana · até a sua conduta
      </p>

      <ol className="landing-timeline mt-4" aria-label="Jornada da semana até a decisão do psicólogo">
        {TIMELINE_PREVIEW.map((entry, index) => {
          const lit = step > index;
          const current = step === index + 1;
          return (
            <li
              key={entry.title}
              className={`landing-timeline-row${lit ? ' is-lit' : ''}${current ? ' is-current' : ''}`}
            >
              <div className="landing-timeline-rail" aria-hidden>
                <span className="landing-timeline-dot" />
                <span className="landing-timeline-line" />
              </div>
              <div className="landing-timeline-body">
                <p className="landing-timeline-time">{entry.time}</p>
                <p className="landing-timeline-title">{entry.title}</p>
                <p className="landing-timeline-detail">{entry.detail}</p>
              </div>
            </li>
          );
        })}

        <li className={`landing-timeline-insight${insightAwake ? ' is-awake' : ''}`}>
          <div className="landing-timeline-rail" aria-hidden>
            <span className="landing-insight-orb">
              <LandingIconMark icon="sparkle" className="landing-timeline-sparkle h-3 w-3 text-white" />
            </span>
            <span className="landing-timeline-line" />
          </div>
          <div className="landing-insight-card">
            <span className="landing-insight-ring" aria-hidden />
            <span className="landing-insight-shimmer" aria-hidden />
            <span className="landing-insight-spark landing-insight-spark-a" aria-hidden />
            <span className="landing-insight-spark landing-insight-spark-b" aria-hidden />
            <span className="landing-insight-spark landing-insight-spark-c" aria-hidden />
            <div className="min-w-0">
              <p className="landing-insight-kicker">{TIMELINE_INSIGHT.kicker}</p>
              <p className="text-xs leading-relaxed text-charcoal">
                <span className="font-semibold">{TIMELINE_INSIGHT.title}</span> {TIMELINE_INSIGHT.detail}
              </p>
            </div>
          </div>
        </li>

        <li className={`landing-timeline-decision${decisionAwake ? ' is-awake' : ''}`}>
          <div className="landing-timeline-rail" aria-hidden>
            <span className="landing-decision-orb">
              <LandingIconMark icon="check" className="h-3 w-3 text-white" />
            </span>
          </div>
          <div className="landing-decision-card">
            <p className="landing-decision-kicker">{TIMELINE_DECISION.kicker}</p>
            <p className="text-xs font-semibold leading-snug text-charcoal">{TIMELINE_DECISION.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-charcoal-muted">{TIMELINE_DECISION.detail}</p>
          </div>
        </li>
      </ol>
    </div>
  );
}
