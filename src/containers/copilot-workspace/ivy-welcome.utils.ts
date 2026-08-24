import {
  THERY_DIALOGUE_BODY_MS,
  THERY_DIALOGUE_GAP_MS,
  THERY_DIALOGUE_TITLE_MS,
} from '@containers/onboarding-thery/thery-dialogue.utils';

export const IVY_WELCOME_TITLE = 'Olá, eu sou a IVY, sua assistente';

export const IVY_WELCOME_INTRO =
  'Prazer! Sou sua assistente virtual. Estou aqui para te ajudar a consultar o prontuário, preparar o cuidado e acompanhar o que a família traz entre as sessões.';

export const IVY_WELCOME_SELECT =
  'Para começar, escolha o paciente. Digite o nome ou abra a lista completa. Eu travo o contexto no prontuário dele — e só dele.';

export const IVY_WELCOME_HOLD_MS = 700;
export const IVY_CONFETTI_MS = 1400;

export const IVY_CONFETTI_COLORS = ['#1A86E2', '#7C3AED', '#10B981', '#F59E0B', '#4DA3ED'] as const;

export interface IvyConfettiPiece {
  id: number;
  left: string;
  color: string;
  dx: string;
  dy: string;
  rotate: string;
  delay: string;
  duration: string;
  radius: string;
}

export interface IvyWelcomeView {
  phase: 'hello' | 'select';
  showPicker: boolean;
  bursting: boolean;
}

export const IVY_WELCOME_STORAGE_PREFIX = 'unithery:ivy-welcome';

export function ivyWelcomeStorageKey(userId: string): string {
  return `${IVY_WELCOME_STORAGE_PREFIX}:${userId || 'anon'}`;
}

export function hasSeenIvyWelcome(
  userId: string,
  storage: Pick<Storage, 'getItem'> | null = defaultLocalStorage(),
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(ivyWelcomeStorageKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function markIvyWelcomeSeen(
  userId: string,
  storage: Pick<Storage, 'setItem'> | null = defaultLocalStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(ivyWelcomeStorageKey(userId), '1');
  } catch {
    /* quota / private mode */
  }
}

function defaultLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Peças fixas — sem Math.random, para hidratação estável. */
export function ivyConfettiPieces(): IvyConfettiPiece[] {
  const seeds = [
    [-42, -88, 18, 0, 1100, 40],
    [8, -96, -32, 40, 1200, 50],
    [46, -84, 48, 80, 1050, 45],
    [-58, -52, -18, 120, 1300, 55],
    [62, -48, 70, 160, 1150, 40],
    [-18, -108, 8, 30, 1250, 50],
    [28, -72, -55, 90, 1080, 45],
    [-72, -70, 36, 200, 1180, 55],
    [74, -90, -12, 70, 1220, 40],
    [-8, -64, 62, 140, 1020, 50],
    [52, -110, -40, 50, 1280, 45],
    [-50, -98, 22, 180, 1120, 55],
    [16, -54, -70, 220, 1160, 40],
    [-64, -36, 44, 100, 1240, 50],
    [68, -62, -28, 240, 1090, 45],
    [-30, -78, 80, 10, 1320, 55],
    [38, -42, -8, 260, 1140, 40],
    [-80, -58, 14, 150, 1200, 50],
  ] as const;

  return seeds.map(([dx, dy, rotate, delay, duration, radius], index) => ({
    id: index,
    left: `${48 + (index % 7) * 2}%`,
    color: IVY_CONFETTI_COLORS[index % IVY_CONFETTI_COLORS.length],
    dx: `${dx}px`,
    dy: `${dy}px`,
    rotate: `${rotate}deg`,
    delay: `${delay}ms`,
    duration: `${duration}ms`,
    radius: `${radius}%`,
  }));
}

export function ivyWelcomeHelloMs(title = IVY_WELCOME_TITLE, body = IVY_WELCOME_INTRO): number {
  return title.length * THERY_DIALOGUE_TITLE_MS + THERY_DIALOGUE_GAP_MS + body.length * THERY_DIALOGUE_BODY_MS;
}

export function ivyWelcomeView(input: {
  enabled: boolean;
  reducedMotion: boolean;
  firstVisit: boolean;
  helloDone: boolean;
  holdElapsedMs: number;
  runElapsedMs: number;
}): IvyWelcomeView {
  if (!input.enabled || input.reducedMotion || !input.firstVisit) {
    return { phase: 'select', showPicker: true, bursting: false };
  }

  const select = input.helloDone && input.holdElapsedMs >= IVY_WELCOME_HOLD_MS;
  return {
    phase: select ? 'select' : 'hello',
    showPicker: select,
    bursting: input.runElapsedMs < IVY_CONFETTI_MS,
  };
}
