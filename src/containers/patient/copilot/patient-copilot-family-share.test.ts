import { describe, expect, it } from 'vitest';
import {
  buildArtifactSaveToast,
  buildVisibilityChangeToast,
  getFamilyShareStatusLabel,
} from './patient-copilot-family-share.utils';

describe('patient-copilot-family-share.utils', () => {
  it('retorna microcopy privado quando toggle off', () => {
    expect(getFamilyShareStatusLabel(false)).toBe('🔒 Apenas visualização interna');
  });

  it('retorna microcopy compartilhado quando toggle on', () => {
    expect(getFamilyShareStatusLabel(true)).toBe('📱 Visível para a família');
  });

  it('monta toast de save privado', () => {
    expect(buildArtifactSaveToast('acao_recomendada', false)).toContain('uso interno');
  });

  it('monta toast de save compartilhado', () => {
    expect(buildArtifactSaveToast('resumo_proativo', true)).toContain('visível para a família');
  });

  it('monta toast de alteração de visibilidade', () => {
    expect(buildVisibilityChangeToast(true)).toContain('família');
    expect(buildVisibilityChangeToast(false)).toContain('interno');
  });
});
