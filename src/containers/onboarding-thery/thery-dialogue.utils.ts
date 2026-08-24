export const THERY_DIALOGUE_TITLE_MS = 26;
export const THERY_DIALOGUE_BODY_MS = 15;
export const THERY_DIALOGUE_GAP_MS = 220;

export type TheryDialogueCaret = 'title' | 'body';

export interface TheryDialogueFrame {
  title: string;
  body: string;
  done: boolean;
  caret: TheryDialogueCaret;
}

export function prefersReducedMotion(
  matchMedia: (query: string) => { matches: boolean } = globalThis.matchMedia?.bind(globalThis) ?? (() => ({ matches: false })),
): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function theryDialogueFrame(
  elapsedMs: number,
  title: string,
  body: string,
  instant = false,
): TheryDialogueFrame {
  if (instant || elapsedMs < 0) {
    return { title, body, done: true, caret: 'body' };
  }

  const titleDur = title.length * THERY_DIALOGUE_TITLE_MS;
  if (elapsedMs < titleDur) {
    const count = Math.min(title.length, Math.floor(elapsedMs / THERY_DIALOGUE_TITLE_MS) + 1);
    return { title: title.slice(0, count), body: '', done: false, caret: 'title' };
  }

  if (elapsedMs < titleDur + THERY_DIALOGUE_GAP_MS) {
    return { title, body: '', done: false, caret: 'body' };
  }

  const bodyElapsed = elapsedMs - titleDur - THERY_DIALOGUE_GAP_MS;
  const count = Math.min(body.length, Math.floor(bodyElapsed / THERY_DIALOGUE_BODY_MS) + 1);
  if (count >= body.length) {
    return { title, body, done: true, caret: 'body' };
  }

  return { title, body: body.slice(0, count), done: false, caret: 'body' };
}
