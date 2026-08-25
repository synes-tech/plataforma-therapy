/** Origens confiáveis para voltar do Stripe Checkout. */
export const STRIPE_RETURN_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://unithery.com',
  'https://www.unithery.com',
] as const;

function stripSlash(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\/$/, '');
}

/**
 * Prefere o Origin da requisição (ex.: localhost) quando ele está na allowlist.
 * Só cai no STRIPE_APP_ORIGIN configurado se o Origin não for confiável.
 */
export function resolveStripeReturnOrigin(
  requestOrigin: string | null | undefined,
  configured: string | null | undefined,
): string {
  const origin = stripSlash(requestOrigin);
  if (origin && (STRIPE_RETURN_ORIGINS as readonly string[]).includes(origin)) {
    return origin;
  }
  const fallback = stripSlash(configured);
  if (fallback) return fallback;
  if (origin) return origin;
  return 'http://localhost:5173';
}

export function originFromRequest(req: Request): string | null {
  const origin = req.headers.get('origin');
  if (origin) return origin;
  const referer = req.headers.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
