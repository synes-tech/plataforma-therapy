import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '@containers/onboarding-thery/thery-dialogue.utils';
import { useTheryDialogue } from '@containers/onboarding-thery/useTheryDialogue';
import {
  IVY_CONFETTI_MS,
  IVY_WELCOME_HOLD_MS,
  IVY_WELCOME_INTRO,
  IVY_WELCOME_TITLE,
  hasSeenIvyWelcome,
  ivyWelcomeView,
  markIvyWelcomeSeen,
} from './ivy-welcome.utils';

export function useIvyWelcome(enabled: boolean, userId = 'anon') {
  const reducedMotion = prefersReducedMotion();
  const [playIntro] = useState(
    () => enabled && !reducedMotion && !hasSeenIvyWelcome(userId),
  );
  const [runId, setRunId] = useState(0);
  const [holdElapsedMs, setHoldElapsedMs] = useState(0);
  const [runElapsedMs, setRunElapsedMs] = useState(0);
  const dialogue = useTheryDialogue(
    IVY_WELCOME_TITLE,
    IVY_WELCOME_INTRO,
    playIntro ? `ivy-${runId}` : 'off',
  );
  const helloDone = !playIntro || dialogue.frame.done;
  const view = ivyWelcomeView({
    enabled,
    reducedMotion,
    firstVisit: playIntro,
    helloDone,
    holdElapsedMs,
    runElapsedMs,
  });

  useEffect(() => {
    if (!playIntro) return undefined;

    let frameId = 0;
    const startedAt = performance.now();

    function tick(now: number) {
      const elapsed = now - startedAt;
      setRunElapsedMs(elapsed);
      if (elapsed < IVY_CONFETTI_MS) {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [playIntro, runId]);

  useEffect(() => {
    if (!playIntro || !dialogue.frame.done || view.phase === 'select') {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setHoldElapsedMs(IVY_WELCOME_HOLD_MS);
    }, IVY_WELCOME_HOLD_MS);

    return () => window.clearTimeout(timer);
  }, [dialogue.frame.done, playIntro, runId, view.phase]);

  useEffect(() => {
    if (!enabled || !playIntro || !view.showPicker) return;
    markIvyWelcomeSeen(userId);
  }, [enabled, playIntro, userId, view.showPicker]);

  function replay() {
    if (!playIntro) return;
    setHoldElapsedMs(0);
    setRunElapsedMs(0);
    setRunId((current) => current + 1);
  }

  function skip() {
    dialogue.skip();
    setHoldElapsedMs(IVY_WELCOME_HOLD_MS);
    setRunElapsedMs(IVY_CONFETTI_MS);
    markIvyWelcomeSeen(userId);
  }

  const title = !enabled ? undefined : playIntro ? dialogue.frame.title : IVY_WELCOME_TITLE;
  const body = playIntro && view.phase === 'hello' ? dialogue.frame.body : undefined;
  const caret = playIntro && view.phase === 'hello' && !dialogue.frame.done ? dialogue.frame.caret : null;

  return {
    playIntro,
    runId,
    title,
    body,
    caret,
    showPicker: view.showPicker,
    bursting: view.bursting,
    replay,
    skip,
  };
}
