/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { pathFromTab, tabFromPath } from './patient-record.tabs';

describe('patient-record.tabs', () => {
  it('usa copilot como aba padrão', () => {
    expect(tabFromPath()).toBe('copilot');
    expect(tabFromPath(undefined)).toBe('copilot');
  });

  it('mapeia segmentos de URL para abas', () => {
    expect(tabFromPath('overview')).toBe('overview');
    expect(tabFromPath('clinical')).toBe('clinical');
    expect(tabFromPath('documents')).toBe('documents');
    expect(tabFromPath('checkins')).toBe('checkins');
    expect(tabFromPath('crisis-control')).toBe('checkins');
    expect(tabFromPath('saved-recommendations')).toBe('documents');
  });

  it('gera paths de navegação', () => {
    expect(pathFromTab('copilot')).toBe('copilot');
    expect(pathFromTab('documents')).toBe('documents');
  });
});
