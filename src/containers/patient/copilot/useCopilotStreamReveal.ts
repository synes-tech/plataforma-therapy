import { useCallback, useEffect, useRef } from 'react';

/**
 * Revela o texto do stream como "digitação rápida" sem travar a UI.
 * Bufferiza chunks da rede e libera em fatias por frame (RAF).
 */
export function useCopilotStreamReveal(
  onReveal: (nextVisible: string) => void,
  charsPerFrame = 36,
) {
  const bufferRef = useRef('');
  const visibleRef = useRef('');
  const rafRef = useRef<number | null>(null);
  const streamingRef = useRef(false);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    rafRef.current = null;
    const remaining = bufferRef.current.length - visibleRef.current.length;
    if (remaining <= 0) {
      if (streamingRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
      return;
    }

    const step = Math.min(charsPerFrame, remaining);
    visibleRef.current = bufferRef.current.slice(0, visibleRef.current.length + step);
    onReveal(visibleRef.current);

    if (visibleRef.current.length < bufferRef.current.length || streamingRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [charsPerFrame, onReveal]);

  const ensureRaf = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const start = useCallback(() => {
    bufferRef.current = '';
    visibleRef.current = '';
    streamingRef.current = true;
    stopRaf();
  }, [stopRaf]);

  const pushChunk = useCallback(
    (text: string) => {
      if (!text) return;
      bufferRef.current += text;
      ensureRaf();
    },
    [ensureRaf],
  );

  const finish = useCallback(
    (finalText?: string) => {
      streamingRef.current = false;
      if (typeof finalText === 'string') {
        bufferRef.current = finalText;
      }
      // Flush remaining quickly
      visibleRef.current = bufferRef.current;
      onReveal(visibleRef.current);
      stopRaf();
    },
    [onReveal, stopRaf],
  );

  const reset = useCallback(() => {
    streamingRef.current = false;
    bufferRef.current = '';
    visibleRef.current = '';
    stopRaf();
  }, [stopRaf]);

  useEffect(() => () => stopRaf(), [stopRaf]);

  return { start, pushChunk, finish, reset };
}
