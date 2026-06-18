/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  validatePatientAvatarFile,
  PATIENT_AVATAR_MAX_BYTES,
} from './patient-avatar.validation';

function mockFile(type: string, size: number): File {
  return { type, size } as File;
}

describe('validatePatientAvatarFile', () => {
  it('aceita PNG, JPG e WebP dentro do limite', () => {
    expect(validatePatientAvatarFile(mockFile('image/png', 1024)).valid).toBe(true);
    expect(validatePatientAvatarFile(mockFile('image/jpeg', 1024)).valid).toBe(true);
    expect(validatePatientAvatarFile(mockFile('image/webp', 1024)).valid).toBe(true);
  });

  it('rejeita tipo inválido', () => {
    const result = validatePatientAvatarFile(mockFile('application/pdf', 1024));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.message).toContain('PNG');
  });

  it('rejeita arquivo maior que 5 MB', () => {
    const result = validatePatientAvatarFile(mockFile('image/png', PATIENT_AVATAR_MAX_BYTES + 1));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.message).toContain('5 MB');
  });
});
