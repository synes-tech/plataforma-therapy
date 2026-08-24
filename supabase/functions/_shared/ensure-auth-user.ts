import { createServiceClient } from './supabase.ts';
import { ensureAuthUserRpcArgs } from './ensure-auth-user.utils.ts';

/** Espelha o UID do Identity Platform em auth.users para as FKs do Cloud SQL. */
export async function ensureAuthUser(id: string, email?: string | null): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.rpc('ensure_auth_user', ensureAuthUserRpcArgs(id, email));
  if (error) {
    throw new Error(`ensure_auth_user: ${error.message}`);
  }
}
