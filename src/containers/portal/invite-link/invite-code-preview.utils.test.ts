import { describe, expect, it } from 'vitest';
import {
  INVITE_CODE_LENGTH,
  isInviteCodeComplete,
  normalizeInviteCodeInput,
} from './invite-code-preview.utils';

describe('invite-code-preview.utils', () => {
  it('normaliza espaços e limita ao tamanho do código', () => {
    expect(normalizeInviteCodeInput(' Ab C12 xYz ')).toBe('AbC12xYz');
    expect(normalizeInviteCodeInput('123456789')).toHaveLength(INVITE_CODE_LENGTH);
  });

  it('identifica código completo', () => {
    expect(isInviteCodeComplete('AbC12xYz')).toBe(true);
    expect(isInviteCodeComplete('AbC12')).toBe(false);
  });
});
