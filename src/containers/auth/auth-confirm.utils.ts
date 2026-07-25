import type { EmailOtpType } from '@supabase/supabase-js';

/** Tipos aceitos pelo verifyOtp (signup/magiclink foram unificados em email). */
export function mapAuthConfirmOtpType(rawType: string): EmailOtpType {
  if (rawType === 'signup' || rawType === 'magiclink') return 'email';
  if (rawType === 'recovery') return 'recovery';
  if (rawType === 'email_change' || rawType === 'email_change_new') return 'email_change';
  if (rawType === 'invite') return 'invite';
  return 'email';
}

export function isRecoveryConfirmType(rawType: string | null): boolean {
  return rawType === 'recovery';
}

export function resolveAuthConfirmRedirectPath(redirectTo: string | null): string {
  if (!redirectTo) return '/';
  try {
    const url = new URL(redirectTo, window.location.origin);
    if (url.origin !== window.location.origin) return '/';
    return `${url.pathname}${url.search}${url.hash}` || '/';
  } catch {
    return redirectTo.startsWith('/') ? redirectTo : '/';
  }
}
