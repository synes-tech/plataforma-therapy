import { useCallback, useEffect, useRef } from 'react';

const NEAR_BOTTOM_PX = 96;

/**
 * Mantém o chat no fim apenas se o usuário já estiver perto do rodapé.
 * Evita "tremida"/scroll forçado enquanto a resposta cresce.
 */
export function useStickyChatScroll(dependency: unknown) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance <= NEAR_BOTTOM_PX;
  }, []);

  const scrollToBottomIfStuck = useCallback(() => {
    const el = containerRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottomIfStuck();
  }, [dependency, scrollToBottomIfStuck]);

  return { containerRef, onScroll, scrollToBottomIfStuck };
}
