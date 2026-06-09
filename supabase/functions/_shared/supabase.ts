import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

/**
 * Creates a Supabase client that inherits the user's JWT for RLS enforcement.
 * Use this for all user-facing operations.
 */
export function createUserClient(token: string): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    db: { schema: 'public' },
  });
}

/**
 * Creates a Supabase client with service_role key (bypasses RLS).
 * ONLY use for internal system operations: cron jobs, webhooks, admin tasks.
 * NEVER use for user-facing requests.
 */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });
}

/**
 * Extracts the bearer token from a request's Authorization header.
 */
export function extractToken(req: Request): string {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header');
  }
  return authHeader.replace('Bearer ', '');
}
