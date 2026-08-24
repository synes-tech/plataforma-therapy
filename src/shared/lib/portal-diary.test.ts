/**
 * Regras do diário do portal.
 *
 * O que estes testes protegem: um cuidador e um paciente não podem gravar o mesmo tipo de
 * dado. Se a projeção 1–10 → 1–5 quebrar, o calendário e os alertas de crise passam a ler
 * uma escala que não existe. Se o allowlist de chips encolher, o check-in de um cuidador
 * de adulto perde "trabalho" em silêncio.
 */
import { describe, expect, it } from 'vitest';
import {
  ADULT_CAREGIVER_CHIPS,
  CAREGIVER_CHIPS,
  SELF_CHIPS,
  anxietyScaleLabel,
  buildDiarySubmission,
  canSubmitDiary,
  chipsForContext,
  chipsForMode,
  moodScaleLabel,
  projectMood10To5,
  type DiaryFormState,
} from './portal-diary';
import { portalNavItems } from './portal-nav';
import { portalTitle, subjectLabel, type PortalContext } from './portal-context';
import {
  ADULT_CAREGIVER_CATEGORIES,
  CAREGIVER_CATEGORIES,
  SELF_CATEGORIES,
  allowedCategoriesForMode,
  normalizeCategories,
  normalizeDiaryPayload,
  projectMood10To5 as projectMood10To5Backend,
} from '../../../supabase/functions/_shared/portal-diary.ts';

function caregiverForm(overrides: Partial<DiaryFormState> = {}): DiaryFormState {
  return {
    mode: 'CAREGIVER',
    mood: 4,
    sleep: 3,
    crisisOccurred: false,
    crisisLevel: 3,
    categories: ['escola'],
    notes: '',
    self: { mood10: 5, anxiety10: 5, triggers: '' },
    ...overrides,
  };
}

function selfForm(overrides: Partial<DiaryFormState> = {}): DiaryFormState {
  return caregiverForm({ mode: 'SELF', mood: null, ...overrides });
}

function portal(overrides: Partial<PortalContext> = {}): PortalContext {
  return {
    patient: {
      id: 'p1',
      name: 'Lucas Silva',
      first_name: 'Lucas',
      profile_type: 'CHILD',
      active_modules: ['CLINICO_GERAL', 'NEURODESENVOLVIMENTO'],
      birth_date: '2018-01-01',
    },
    access: {
      level: 'CAREGIVER',
      link_id: 'l1',
      relationship: 'mãe',
      is_primary_contact: true,
    },
    subscription: null,
    capabilities: { companion_chat: false, can_subscribe: false },
    ...overrides,
  };
}

describe('projeção da escala de humor', () => {
  it('mapeia 1–10 para 1–5 sem perder os extremos', () => {
    expect(projectMood10To5(1)).toBe(1);
    expect(projectMood10To5(2)).toBe(1);
    expect(projectMood10To5(3)).toBe(2);
    expect(projectMood10To5(10)).toBe(5);
  });

  it('prende valores fora da escala em vez de estourar a coluna', () => {
    expect(projectMood10To5(0)).toBe(1);
    expect(projectMood10To5(11)).toBe(5);
  });
});

describe('chips por modo e perfil', () => {
  it('cuidador de criança vê escola, agitação e sensorial', () => {
    expect(chipsForContext('CAREGIVER', 'CHILD').map((c) => c.id)).toEqual(
      CAREGIVER_CHIPS.map((c) => c.id),
    );
    expect(chipsForContext('CAREGIVER', 'CHILD').map((c) => c.id)).toContain('escola');
    expect(chipsForContext('CAREGIVER', 'CHILD').map((c) => c.id)).toContain('hiperatividade');
  });

  it('cuidador de adulto não vê escola nem agitação', () => {
    const ids = chipsForContext('CAREGIVER', 'ADULT').map((c) => c.id);
    expect(ids).toEqual(ADULT_CAREGIVER_CHIPS.map((c) => c.id));
    expect(ids).not.toContain('escola');
    expect(ids).not.toContain('hiperatividade');
    expect(ids).toContain('trabalho');
  });

  it('auto-relato sempre usa as chips de primeira pessoa', () => {
    expect(chipsForContext('SELF', 'ADULT')).toEqual(SELF_CHIPS);
    expect(chipsForContext('SELF', 'CHILD')).toEqual(SELF_CHIPS);
  });

  it('chipsForMode sem perfil preserva o vocabulário infantil — o default das famílias atuais', () => {
    expect(chipsForMode('CAREGIVER')).toEqual(CAREGIVER_CHIPS);
  });
});

describe('payload do check-in', () => {
  it('cuidador não envia enquanto humor ou sono faltarem', () => {
    expect(buildDiarySubmission(caregiverForm({ mood: null }))).toBeNull();
    expect(buildDiarySubmission(caregiverForm({ sleep: null }))).toBeNull();
    expect(canSubmitDiary(caregiverForm())).toBe(true);
  });

  it('auto-relato projeta o humor e guarda a escala original no payload', () => {
    const submission = buildDiarySubmission(
      selfForm({ self: { mood10: 7, anxiety10: 8, triggers: 'Reunião de manhã' } }),
    );
    expect(submission?.mood_score).toBe(4);
    expect(submission?.payload).toEqual({
      mood_10: 7,
      anxiety_10: 8,
      triggers: 'Reunião de manhã',
    });
  });

  it('auto-relato não exige clique extra no humor — o slider já começa no neutro', () => {
    expect(canSubmitDiary(selfForm({ mood: null, sleep: 3 }))).toBe(true);
    expect(canSubmitDiary(selfForm({ sleep: null }))).toBe(false);
  });

  it('cuidador não mistura payload de auto-relato no registro', () => {
    expect(buildDiarySubmission(caregiverForm())?.payload).toBeUndefined();
  });
});

describe('rótulos das escalas', () => {
  it('ansiedade cresce ao contrário do humor', () => {
    expect(moodScaleLabel(1)).toBe('Muito difícil');
    expect(moodScaleLabel(10)).toBe('Muito bom');
    expect(anxietyScaleLabel(1)).toBe('Tranquilo');
    expect(anxietyScaleLabel(10)).toBe('Muito alta');
  });
});

describe('navegação do portal', () => {
  it('cuidador vê Diário, Calendário e Combinados — sem a aba de chat', () => {
    const labels = portalNavItems(portal()).map((i) => i.label);
    expect(labels).toEqual(['Diário', 'Calendário', 'Relatórios e Combinados', 'Ajuda']);
  });

  it('paciente vê Ivy no centro mesmo sem assinatura', () => {
    const labels = portalNavItems(
      portal({
        patient: { ...portal().patient, profile_type: 'ADULT', first_name: 'Ana' },
        access: { ...portal().access, level: 'SELF' },
      }),
    ).map((i) => i.label);
    expect(labels).toEqual(['Meu dia', 'Histórico', 'Ivy', 'Plano de cuidados', 'Ajuda']);
  });

  it('paciente assinante mantém Ivy no centro', () => {
    const labels = portalNavItems(
      portal({
        access: { ...portal().access, level: 'SELF' },
        capabilities: { companion_chat: true, can_subscribe: false },
      }),
    ).map((i) => i.label);
    expect(labels).toEqual(['Meu dia', 'Histórico', 'Ivy', 'Plano de cuidados', 'Ajuda']);
  });
});

describe('espelho frontend/backend', () => {
  it('a projeção 1–10 → 1–5 é a mesma nos dois lados', () => {
    for (const n of [1, 2, 5, 7, 10]) {
      expect(projectMood10To5(n)).toBe(projectMood10To5Backend(n));
    }
  });

  it('os ids das chips batem com o allowlist do backend', () => {
    expect(CAREGIVER_CHIPS.map((c) => c.id)).toEqual([...CAREGIVER_CATEGORIES]);
    expect(SELF_CHIPS.map((c) => c.id)).toEqual([...SELF_CATEGORIES]);
    expect(ADULT_CAREGIVER_CHIPS.map((c) => c.id)).toEqual([...ADULT_CAREGIVER_CATEGORIES]);
  });

  it('cuidador de adulto pode gravar trabalho; de criança, escola — os dois sobrevivem', () => {
    expect(normalizeCategories('CAREGIVER', ['escola', 'trabalho', 'inventado'])).toEqual([
      'escola',
      'trabalho',
    ]);
    expect(allowedCategoriesForMode('SELF')).not.toContain('escola');
  });

  it('descarta chave de payload que não pertence ao modo, sem recusar o check-in', () => {
    const caregiver = normalizeDiaryPayload('CAREGIVER', { mood_10: 8, triggers: 'x' });
    expect(caregiver.payload).toEqual({});
    expect(caregiver.errors).toEqual({});

    const self = normalizeDiaryPayload('SELF', { mood_10: 8, unknown: true });
    expect(self.payload).toEqual({ mood_10: 8 });
  });
});

describe('como o portal se refere ao paciente', () => {
  it('cuidador lê o primeiro nome; o paciente lê "você"', () => {
    expect(subjectLabel(portal())).toBe('Lucas');
    expect(subjectLabel(portal({ access: { ...portal().access, level: 'SELF' } }))).toBe('você');
  });

  it('o título do layout muda com o modo', () => {
    expect(portalTitle(portal())).toBe('Portal Unithery');
    expect(portalTitle(portal({ access: { ...portal().access, level: 'SELF' } }))).toBe('Meu espaço');
  });
});
