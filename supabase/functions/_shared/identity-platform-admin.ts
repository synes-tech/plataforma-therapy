/**
 * Admin Identity Platform / Firebase Auth via REST (sem GoTrue / Supabase Auth).
 * Usa GCP_SERVICE_ACCOUNT com scope cloud-platform + identitytoolkit.
 */
import { encodeBase64, decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { sendSesEmail } from './aws-ses.ts';

export type IdpRole = 'master' | 'clinic_admin' | 'professional' | 'family';

export interface IdpClaims {
  role: IdpRole;
  clinic_id?: string | null;
  is_solo?: boolean;
}

export interface CreateIdpUserInput {
  email: string;
  password: string;
  displayName?: string;
  emailVerified?: boolean;
  claims?: IdpClaims;
  /** Se omitido, gera UUID v4 (compatível com FKs user_id). */
  uid?: string;
}

export interface IdpUser {
  id: string;
  email: string;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

let sa: ServiceAccount | null = null;
let cachedKey: CryptoKey | null = null;
let cachedToken: { token: string; expiresAt: number } | null = null;

function projectId(): string {
  return (
    Deno.env.get('FIREBASE_PROJECT_ID')
    ?? Deno.env.get('GCP_PROJECT')
    ?? Deno.env.get('GOOGLE_CLOUD_PROJECT')
    ?? getServiceAccount().project_id
    ?? 'plataforma-therapy-ai'
  );
}

function getServiceAccount(): ServiceAccount {
  if (sa) return sa;
  const raw = Deno.env.get('GCP_SERVICE_ACCOUNT');
  if (!raw) throw new Error('Missing GCP_SERVICE_ACCOUNT for Identity Platform admin');
  try {
    sa = JSON.parse(new TextDecoder().decode(decodeBase64(raw))) as ServiceAccount;
  } catch {
    sa = JSON.parse(raw) as ServiceAccount;
  }
  return sa;
}

function toB64Url(bytes: Uint8Array): string {
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function strToB64Url(str: string): string {
  return toB64Url(new TextEncoder().encode(str));
}

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const account = getServiceAccount();
  const pem = account.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  cachedKey = await crypto.subtle.importKey(
    'pkcs8',
    decodeBase64(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return cachedKey;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const account = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = strToB64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = strToB64Url(JSON.stringify({
    iss: account.client_email,
    scope: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/identitytoolkit',
      'https://www.googleapis.com/auth/firebase',
    ].join(' '),
    aud: account.token_uri,
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claim}`;
  const key = await getSigningKey();
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${toB64Url(new Uint8Array(sig))}`;
  const res = await fetch(account.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Identity Platform token error ${res.status}: ${json.error ?? 'unknown'}`);
  }
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

function claimsToCustomAttributes(claims: IdpClaims): string {
  const attrs: Record<string, unknown> = { role: claims.role };
  if (claims.clinic_id) attrs.clinic_id = claims.clinic_id;
  if (claims.is_solo === true) attrs.is_solo = true;
  return JSON.stringify(attrs);
}

async function idpFetch(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId()}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string; status?: string } | undefined;
    const message = err?.message ?? JSON.stringify(json);
    throw new Error(message);
  }
  return json;
}

export function isIdpEmailExistsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /EMAIL_EXISTS|email.*already|ALREADY_EXISTS/i.test(msg);
}

export async function createIdpUser(input: CreateIdpUserInput): Promise<IdpUser> {
  const uid = input.uid ?? crypto.randomUUID();
  const email = input.email.trim().toLowerCase();

  await idpFetch('/accounts', {
    localId: uid,
    email,
    password: input.password,
    displayName: input.displayName ?? undefined,
    emailVerified: input.emailVerified ?? false,
    disabled: false,
  });

  if (input.claims) {
    await setIdpClaims(uid, input.claims);
  }

  return { id: uid, email };
}

export async function setIdpClaims(uid: string, claims: IdpClaims): Promise<void> {
  await idpFetch('/accounts:update', {
    localId: uid,
    customAttributes: claimsToCustomAttributes(claims),
  });
}

export async function deleteIdpUser(uid: string): Promise<void> {
  try {
    await idpFetch('/accounts:delete', { localId: uid });
  } catch (err) {
    console.warn(JSON.stringify({
      level: 'warn',
      action: 'idp_delete_user_failed',
      uid,
      message: err instanceof Error ? err.message : String(err),
    }));
  }
}

/** Gera link de verificação e envia via SES (substitui GoTrue resend/signup). */
export async function sendIdpEmailVerification(
  email: string,
  continueUrl: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const json = await idpFetch('/accounts:sendOobCode', {
    requestType: 'VERIFY_EMAIL',
    email: normalized,
    returnOobLink: true,
    continueUrl,
  });

  const oobLink = typeof json.oobLink === 'string' ? json.oobLink : null;
  if (!oobLink) {
    throw new Error('Identity Platform não retornou oobLink de verificação');
  }

  const subject = 'Confirme seu e-mail — Unithery';
  const text = [
    'Bem-vindo à Unithery.',
    '',
    'Confirme seu e-mail clicando no link abaixo:',
    oobLink,
    '',
    'Se você não criou esta conta, ignore este e-mail.',
  ].join('\n');

  const html = `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1a1a1a">
      <h1 style="font-size:22px">Confirme seu e-mail</h1>
      <p>Bem-vindo à Unithery. Clique no botão abaixo para ativar sua conta.</p>
      <p style="margin:28px 0">
        <a href="${oobLink}"
           style="display:inline-block;background:#1a1a1a;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-family:system-ui,sans-serif;font-size:14px">
          Confirmar e-mail
        </a>
      </p>
      <p style="font-size:12px;color:#666">Se o botão não funcionar, use este link:<br/>${oobLink}</p>
    </div>
  `;

  await sendSesEmail({ to: normalized, subject, html, text });
}

export function buildSignupConfirmRedirect(origin: string): string {
  return `${origin.replace(/\/$/, '')}/login?confirmed=1`;
}
