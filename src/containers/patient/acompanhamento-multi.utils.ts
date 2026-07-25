import { ACOMPANHAMENTO_OPTIONS } from './patient-anamnesis.types';

export const ACOMPANHAMENTO_OTHER_LABEL = 'Outro';

const PRESET_SET = new Set<string>(ACOMPANHAMENTO_OPTIONS);

export function isPresetAcompanhamento(value: string): boolean {
  return PRESET_SET.has(value);
}

export function getCustomAcompanhamentos(values: readonly string[]): string[] {
  return values.filter((value) => !isPresetAcompanhamento(value));
}

export function togglePresetAcompanhamento(current: readonly string[], option: string): string[] {
  return current.includes(option)
    ? current.filter((value) => value !== option)
    : [...current, option];
}

export function addCustomAcompanhamento(current: readonly string[], raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === ACOMPANHAMENTO_OTHER_LABEL) return [...current];
  if (current.includes(trimmed)) return [...current];
  return [...current, trimmed];
}

export function removeAcompanhamento(current: readonly string[], option: string): string[] {
  return current.filter((value) => value !== option);
}
