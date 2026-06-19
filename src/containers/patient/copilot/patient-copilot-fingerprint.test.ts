import { describe, expect, it } from 'vitest';
import {
  artifactFingerprint,
  artifactSaveKey,
  normalizeArtifactText,
} from './patient-copilot-fingerprint';

describe('normalizeArtifactText', () => {
  it('trim e colapsa espaços', () => {
    expect(normalizeArtifactText('  Olá   mundo  ')).toBe('Olá mundo');
  });
});

describe('artifactFingerprint', () => {
  it('gera hash estável para o mesmo texto', async () => {
    const a = await artifactFingerprint('Texto da IA');
    const b = await artifactFingerprint('Texto da IA');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('ignora diferenças de espaçamento', async () => {
    const a = await artifactFingerprint('Texto   da IA');
    const b = await artifactFingerprint(' Texto da IA ');
    expect(a).toBe(b);
  });
});

describe('artifactSaveKey', () => {
  it('combina fingerprint e tipo', () => {
    expect(artifactSaveKey('abc123', 'acao_recomendada')).toBe('abc123:acao_recomendada');
  });
});
