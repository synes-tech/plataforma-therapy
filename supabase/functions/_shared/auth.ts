import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { UnauthorizedError, ForbiddenError } from './errors.ts';

export type UserRole = 'master' | 'clinic_admin' | 'professional' | 'family';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  clinic_id: string | null;
  is_solo: boolean;
}

/**
 * Validates the JWT from the Authorization header and extracts user info.
 * Throws UnauthorizedError if token is missing or invalid.
 */
export async function authenticateRequest(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  // Extract custom claims from user metadata (set via Database Hook on auth.users)
  const role = (user.app_metadata?.role as UserRole) ?? 'family';
  const clinicId = (user.app_metadata?.clinic_id as string) ?? null;
  const isSolo = user.app_metadata?.is_solo === true;

  return {
    id: user.id,
    email: user.email ?? '',
    role,
    clinic_id: clinicId,
    is_solo: isSolo,
  };
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
  if (user.role === 'master') return; // Master has global access
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
