import type { DayActionAnchor } from './calendar-day-action.types';

const DEFAULT_WIDTH = 224;
const DEFAULT_HEIGHT = 108;
const PADDING = 8;

export function computePopoverPosition(
  anchor: DayActionAnchor,
  popoverWidth = DEFAULT_WIDTH,
  popoverHeight = DEFAULT_HEIGHT,
  viewport?: { width: number; height: number },
): { top: number; left: number } {
  const vp = viewport ?? {
    width: typeof globalThis.window !== 'undefined' ? globalThis.window.innerWidth : 1024,
    height: typeof globalThis.window !== 'undefined' ? globalThis.window.innerHeight : 768,
  };
  let top = anchor.bottom + PADDING;
  let left = anchor.left + anchor.width / 2 - popoverWidth / 2;

  if (top + popoverHeight > vp.height - PADDING) {
    top = anchor.top - popoverHeight - PADDING;
  }

  if (left + popoverWidth > vp.width - PADDING) {
    left = vp.width - popoverWidth - PADDING;
  }

  if (left < PADDING) {
    left = PADDING;
  }

  if (top < PADDING) {
    top = PADDING;
  }

  return { top, left };
}
