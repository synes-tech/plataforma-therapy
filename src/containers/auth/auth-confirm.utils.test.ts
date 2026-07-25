import { describe, expect, it } from 'vitest';
import {
  isRecoveryConfirmType,
  mapAuthConfirmOtpType,
  resolveAuthConfirmRedirectPath,
} from './auth-confirm.utils';

describe('mapAuthConfirmOtpType', () => {
  it('maps signup and magiclink to email', () => {
    expect(mapAuthConfirmOtpType('signup')).toBe('email');
    expect(mapAuthConfirmOtpType('magiclink')).toBe('email');
  });

  it('keeps recovery and invite', () => {
    expect(mapAuthConfirmOtpType('recovery')).toBe('recovery');
    expect(mapAuthConfirmOtpType('invite')).toBe('invite');
  });
});

describe('resolveAuthConfirmRedirectPath', () => {
  it('keeps relative redirect paths', () => {
    expect(resolveAuthConfirmRedirectPath('/login?confirmed=1')).toBe('/login?confirmed=1');
  });

  it('rejects external origins', () => {
    expect(resolveAuthConfirmRedirectPath('https://evil.example/steal')).toBe('/');
  });
});

describe('isRecoveryConfirmType', () => {
  it('detects recovery links', () => {
    expect(isRecoveryConfirmType('recovery')).toBe(true);
    expect(isRecoveryConfirmType('email')).toBe(false);
  });
});
