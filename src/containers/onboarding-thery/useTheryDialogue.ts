import { useEffect, useState } from 'react';
import { prefersReducedMotion, theryDialogueFrame } from './thery-dialogue.utils';

export function useTheryDialogue(title: string, body: string, replayKey: string) {
  const [runKey, setRunKey] = useState(replayKey);
  const [skipped, setSkipped] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  if (runKey !== replayKey) {
    setRunKey(replayKey);
    setSkipped(false);
    setElapsedMs(0);
  }

  const instant = skipped || prefersReducedMotion();

  useEffect(() => {
    if (instant) return undefined;

    let frameId = 0;
    const startedAt = performance.now();

    function tick(now: number) {
      const next = now - startedAt;
      setElapsedMs(next);
      if (!theryDialogueFrame(next, title, body, false).done) {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [replayKey, title, body, instant]);

  return {
    frame: theryDialogueFrame(elapsedMs, title, body, instant),
    skip: () => setSkipped(true),
  };
}
