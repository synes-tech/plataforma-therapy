/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  ACOMPANHAMENTO_OTHER_LABEL,
  addCustomAcompanhamento,
  getCustomAcompanhamentos,
  isPresetAcompanhamento,
  removeAcompanhamento,
  togglePresetAcompanhamento,
} from './acompanhamento-multi.utils';

describe('acompanhamento-multi.utils', () => {
  it('identifica opções pré-definidas', () => {
    expect(isPresetAcompanhamento('Psicologia')).toBe(true);
    expect(isPresetAcompanhamento('Musicoterapia')).toBe(false);
  });

  it('alterna múltiplas opções fixas', () => {
    expect(togglePresetAcompanhamento([], 'Psicologia')).toEqual(['Psicologia']);
    expect(togglePresetAcompanhamento(['Psicologia'], 'Fonoaudiologia')).toEqual([
      'Psicologia',
      'Fonoaudiologia',
    ]);
    expect(togglePresetAcompanhamento(['Psicologia'], 'Psicologia')).toEqual([]);
  });

  it('adiciona tratamento personalizado sem duplicar', () => {
    const first = addCustomAcompanhamento([], '  Musicoterapia  ');
    expect(first).toEqual(['Musicoterapia']);
    expect(addCustomAcompanhamento(first, 'Musicoterapia')).toEqual(first);
    expect(addCustomAcompanhamento(first, '')).toEqual(first);
    expect(addCustomAcompanhamento(first, ACOMPANHAMENTO_OTHER_LABEL)).toEqual(first);
  });

  it('separa valores customizados dos pré-definidos', () => {
    const values = ['Psicologia', 'Musicoterapia', 'Psicoterapia infantil'];
    expect(getCustomAcompanhamentos(values)).toEqual(['Musicoterapia', 'Psicoterapia infantil']);
  });

  it('remove item da lista', () => {
    expect(removeAcompanhamento(['Psicologia', 'Musicoterapia'], 'Musicoterapia')).toEqual([
      'Psicologia',
    ]);
  });
});
