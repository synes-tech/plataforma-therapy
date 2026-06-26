import { describe, expect, it } from 'vitest';
import { getArtifactVisibilityBadge } from './patient-artifacts.constants';

describe('getArtifactVisibilityBadge', () => {
  it('marca documento privado', () => {
    const badge = getArtifactVisibilityBadge(false);
    expect(badge.label).toContain('🔒');
  });

  it('marca documento compartilhado', () => {
    const badge = getArtifactVisibilityBadge(true);
    expect(badge.label).toContain('📱');
  });
});
