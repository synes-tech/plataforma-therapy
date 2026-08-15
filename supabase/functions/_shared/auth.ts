/**
 * Validates the JWT from the Authorization header and extracts user info.
 * Aceita apenas Identity Platform / Firebase (Google + e-mail).
 * GoTrue / Supabase Auth removido no cutover 100% GCP.
 */
import * as jose from 'https://esm.sh/jose@5.9.6';
import { UnauthorizedError, ForbiddenError } from './errors.ts';

export type UserRole = 'master' | 'clinic_admin' | 'professional' | 'family';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  clinic_id: string | null;
  is_solo: boolean;
}

const GOOGLE_JWKS = jose.createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

function claimsToUser(payload: jose.JWTPayload): AuthenticatedUser | null {
  const sub = typeof payload.sub === 'string' ? payload.sub : null;
  if (!sub) return null;

  const appMeta = (payload.app_metadata && typeof payload.app_metadata === 'object')
    ? payload.app_metadata as Record<string, unknown>
    : {};

  const role = (payload.role as UserRole | undefined)
    ?? (appMeta.role as UserRole | undefined)
    ?? null;
  if (!role) return null;

  const clinicRaw = payload.clinic_id ?? appMeta.clinic_id ?? null;
  const isSolo = payload.is_solo === true || appMeta.is_solo === true;

  return {
    id: sub,
    email: typeof payload.email === 'string' ? payload.email : '',
    role,
    clinic_id: typeof clinicRaw === 'string' ? clinicRaw : null,
    is_solo: isSolo,
  };
}

export interface FirebaseIdentity {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

function firebaseProjectId(): string {
  return Deno.env.get('FIREBASE_PROJECT_ID')
    ?? Deno.env.get('GCP_PROJECT')
    ?? Deno.env.get('GOOGLE_CLOUD_PROJECT')
    ?? 'plataforma-therapy-ai';
}

async function verifyFirebaseJwt(token: string): Promise<jose.JWTPayload> {
  const projectId = firebaseProjectId();
  const { payload } = await jose.jwtVerify(token, GOOGLE_JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  return payload;
}

/** Valida o ID token do Identity Platform sem exigir claims de role (cadastro Google). */
export async function verifyFirebaseIdentity(token: string): Promise<FirebaseIdentity> {
  try {
    const payload = await verifyFirebaseJwt(token);
    const id = typeof payload.sub === 'string' ? payload.sub : null;
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    if (!id || !email) {
      throw new UnauthorizedError('Token Google sem e-mail válido.');
    }
    return {
      id,
      email,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : null,
    };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Token Google inválido ou expirado.');
  }
}

async function authenticateFirebaseToken(token: string): Promise<AuthenticatedUser | null> {
  try {
    const payload = await verifyFirebaseJwt(token);
    return claimsToUser(payload);
  } catch (err) {
    console.error(JSON.stringify({
      level: 'warn',
      action: 'firebase_jwt_verify_failed',
      project_id: firebaseProjectId(),
      message: err instanceof Error ? err.message : String(err),
    }));
    return null;
  }
}

export async function authenticateRequest(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  const firebaseUser = await authenticateFirebaseToken(token);
  if (firebaseUser) return firebaseUser;

  throw new UnauthorizedError('Invalid or expired token');
}

/**
 * Verifies the user is a "clinic owner": master, clinic_admin, or a solo
 * professional (consultório). Regular professionals (employees) are NOT owners.
 * Throws ForbiddenError otherwise.
 */
export function requireClinicOwner(user: AuthenticatedUser): void {
  const isOwner =
    user.role === 'master' ||
    user.role === 'clinic_admin' ||
    (user.role === 'professional' && user.is_solo);

  if (!isOwner) {
    throw new ForbiddenError('Apenas administradores da clínica podem acessar esta área.');
  }
}

/**
 * Verifies that the authenticated user has one of the allowed roles.
 * Throws ForbiddenError if not.
 */
export function requireRole(user: AuthenticatedUser, allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(
      `Role '${user.role}' is not allowed. Required: ${allowedRoles.join(', ')}`
    );
  }
}

/**
 * Verifies the user belongs to the specified clinic.
 * Throws ForbiddenError if clinic_id doesn't match.
 */
export function requireClinic(user: AuthenticatedUser, clinicId: string): void {
  if (user.role === 'master') return;
  if (user.clinic_id !== clinicId) {
    throw new ForbiddenError('Access denied: clinic mismatch');
  }
}

/**
 * Structured logging helper for auth events.
 */
export function logAuthEvent(
  action: string,
  user: AuthenticatedUser,
  functionName: string,
  extra?: Record<string, unknown>
): void {
  console.log(JSON.stringify({
    level: 'info',
    trace_id: crypto.randomUUID(),
    function: functionName,
    user_id: user.id,
    clinic_id: user.clinic_id,
    role: user.role,
    action,
    timestamp: new Date().toISOString(),
    ...extra,
  }));
}
