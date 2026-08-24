/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  ensureAuthUserRpcArgs,
  resolveInviteCreatedBy,
} from '../../../supabase/functions/_shared/ensure-auth-user.utils.ts';

describe('ensureAuthUserRpcArgs', () => {
  it('normaliza e-mail e omite vazio', () => {
    expect(ensureAuthUserRpcArgs('uid-1', '  Mae@Exemplo.com ')).toEqual({
      p_id: 'uid-1',
      p_email: 'mae@exemplo.com',
    });
    expect(ensureAuthUserRpcArgs('uid-2', '   ')).toEqual({
      p_id: 'uid-2',
      p_email: null,
    });
  });
});

describe('resolveInviteCreatedBy', () => {
  it('usa o profissional do convite quando existe', () => {
    expect(resolveInviteCreatedBy('prof-1', 'family-9')).toBe('prof-1');
  });

  it('cai no UID novo se o convite não tiver created_by', () => {
    expect(resolveInviteCreatedBy(null, 'family-9')).toBe('family-9');
    expect(resolveInviteCreatedBy('', 'family-9')).toBe('family-9');
  });
});
