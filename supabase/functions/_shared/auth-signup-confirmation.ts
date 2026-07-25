import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

/**
 * Dispara o Send Email Hook (SES) com template de confirmação de cadastro.
 * Requer `enable_confirmations = true` no Auth.
 */
export async function sendSignupConfirmationEmail(
  email: string,
  emailRedirectTo: string,
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function buildSignupConfirmRedirect(origin: string): string {
  const loginWithBanner = `${origin}/login?confirmed=1`;
  return loginWithBanner;
}
