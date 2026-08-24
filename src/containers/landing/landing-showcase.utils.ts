/** Índice seguro do próximo slide (com volta ao início). */
export function nextShowcaseIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return (index + 1) % count;
}

/** Índice seguro do slide anterior (com volta ao fim). */
export function previousShowcaseIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return (index - 1 + count) % count;
}

export type SwipeIntent = 'next' | 'previous' | 'none';

/** Converte o deslocamento horizontal do ponteiro em intenção de navegação. */
export function swipeIntent(deltaX: number, threshold = 48): SwipeIntent {
  if (deltaX <= -threshold) return 'next';
  if (deltaX >= threshold) return 'previous';
  return 'none';
}

/** Contador exibido no carrossel: "03 / 08". */
export function showcaseCounter(index: number, count: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.min(index + 1, count))} / ${pad(count)}`;
}

/** Avança um passo cíclico dentro de uma demonstração. */
export function nextDemoStep(step: number, count: number): number {
  if (count <= 0) return 0;
  return (step + 1) % count;
}

/** Breakpoint Tailwind `lg`: abaixo dele o carrossel fica fora da tela após o clique no card. */
export const LANDING_LG_MIN_PX = 1024;

/** No mobile/tablet o clique no card precisa levar o usuário até a demonstração. */
export function shouldScrollToShowcaseOnCardClick(viewportWidth: number): boolean {
  return viewportWidth < LANDING_LG_MIN_PX;
}

/** Respeita `prefers-reduced-motion` no deslocamento até o painel. */
export function showcaseScrollBehavior(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? 'auto' : 'smooth';
}

/** No mobile a faixa de abas precisa acompanhar o slide ativo. */
export function shouldAlignActiveShowcaseTab(viewportWidth: number): boolean {
  return viewportWidth < LANDING_LG_MIN_PX;
}

/** Scroll horizontal para colar a aba ativa no início visível da faixa. */
export function showcaseTabScrollLeft(
  tabLeft: number,
  scrollerLeft: number,
  currentScrollLeft: number,
  maxScrollLeft: number,
): number {
  const aligned = tabLeft - scrollerLeft + currentScrollLeft;
  const ceiling = Math.max(0, maxScrollLeft);
  return Math.min(Math.max(0, aligned), ceiling);
}
