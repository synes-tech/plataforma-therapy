/**
 * Object storage GCS-only (cutover 100% GCP — sem fallback Supabase Storage).
 * Paths no DB permanecem relativos; só o backend resolve o bucket físico.
 */
import { encodeBase64, decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

export type LogicalBucket =
  | 'audio-recordings'
  | 'family-diary-audio'
  | 'pacientes-anexos'
  | 'pacientes-avatars'
  | 'profissionais-avatars';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

const DEFAULT_GCS_MAP: Record<LogicalBucket, string> = {
  'audio-recordings': 'unithery-audio-recordings-staging',
  'family-diary-audio': 'unithery-family-diary-audio-staging',
  'pacientes-anexos': 'unithery-pacientes-anexos-staging',
  'pacientes-avatars': 'unithery-pacientes-avatars-staging',
  'profissionais-avatars': 'unithery-profissionais-avatars-staging',
};

const ENV_GCS_MAP: Record<LogicalBucket, string> = {
  'audio-recordings': 'GCS_BUCKET_AUDIO',
  'family-diary-audio': 'GCS_BUCKET_FAMILY_AUDIO',
  'pacientes-anexos': 'GCS_BUCKET_ANEXOS',
  'pacientes-avatars': 'GCS_BUCKET_PATIENT_AVATARS',
  'profissionais-avatars': 'GCS_BUCKET_PRO_AVATARS',
};

function gcsBucket(logical: LogicalBucket): string {
  const envKey = ENV_GCS_MAP[logical];
  return Deno.env.get(envKey) ?? DEFAULT_GCS_MAP[logical];
}

let sa: ServiceAccount | null = null;
let cachedKey: CryptoKey | null = null;
let cachedToken: { token: string; expiresAt: number } | null = null;

function getServiceAccount(): ServiceAccount {
  if (sa) return sa;
  const raw = Deno.env.get('GCP_SERVICE_ACCOUNT');
  if (!raw) throw new Error('Missing GCP_SERVICE_ACCOUNT for GCS');
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
    scope: 'https://www.googleapis.com/auth/devstorage.full_control',
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
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`GCS token error ${res.status}`);
  }
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.token;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function encodeObjectPath(objectPath: string): string {
  return objectPath.split('/').map(encodeURIComponent).join('/');
}

async function createGcsSignedUrl(
  method: 'GET' | 'PUT',
  logical: LogicalBucket,
  objectPath: string,
  expiresSeconds: number,
): Promise<string> {
  const account = getServiceAccount();
  const bucket = gcsBucket(logical);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const datestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`;
  const datetime = `${datestamp}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const credentialScope = `${datestamp}/auto/storage/goog4_request`;
  const credential = `${account.client_email}/${credentialScope}`;
  const host = 'storage.googleapis.com';
  const canonicalUri = `/${bucket}/${encodeObjectPath(objectPath)}`;

  const params = new URLSearchParams({
    'X-Goog-Algorithm': 'GOOG4-RSA-SHA256',
    'X-Goog-Credential': credential,
    'X-Goog-Date': datetime,
    'X-Goog-Expires': String(expiresSeconds),
    'X-Goog-SignedHeaders': 'host',
  });
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const canonicalQuery = sorted
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'GOOG4-RSA-SHA256',
    datetime,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const key = await getSigningKey();
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(stringToSign),
  );
  const sigHex = [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Goog-Signature=${sigHex}`;
}

async function gcsObjectExists(logical: LogicalBucket, objectPath: string): Promise<boolean> {
  const token = await getAccessToken();
  const bucket = gcsBucket(logical);
  const url =
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectPath)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.ok;
}

async function downloadFromGcs(logical: LogicalBucket, objectPath: string): Promise<Uint8Array | null> {
  const token = await getAccessToken();
  const bucket = gcsBucket(logical);
  const url =
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectPath)}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GCS download failed ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function removeFromGcs(logical: LogicalBucket, objectPath: string): Promise<void> {
  const token = await getAccessToken();
  const bucket = gcsBucket(logical);
  const url =
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectPath)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`GCS delete failed ${res.status}`);
  }
}

export async function createUploadUrl(
  logical: LogicalBucket,
  objectPath: string,
  _opts?: { upsert?: boolean },
): Promise<{ signedUrl: string; backend: 'gcs' }> {
  const signedUrl = await createGcsSignedUrl('PUT', logical, objectPath, 3600);
  return { signedUrl, backend: 'gcs' };
}

export async function createReadUrl(
  logical: LogicalBucket,
  objectPath: string,
  expiresSeconds = 3600,
): Promise<{ signedUrl: string; backend: 'gcs' }> {
  const exists = await gcsObjectExists(logical, objectPath);
  if (!exists) throw new Error('Object not found in GCS');
  const signedUrl = await createGcsSignedUrl('GET', logical, objectPath, expiresSeconds);
  return { signedUrl, backend: 'gcs' };
}

export async function downloadBytes(
  logical: LogicalBucket,
  objectPath: string,
): Promise<Uint8Array> {
  const bytes = await downloadFromGcs(logical, objectPath);
  if (!bytes) throw new Error('Object not found in GCS');
  return bytes;
}

export async function removePaths(
  logical: LogicalBucket,
  objectPaths: string[],
): Promise<void> {
  const paths = objectPaths.filter(Boolean);
  if (paths.length === 0) return;

  const errors: string[] = [];
  for (const path of paths) {
    try {
      await removeFromGcs(logical, path);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (errors.length) throw new Error(errors[0]);
}

export function assertPathBelongsToClinic(objectPath: string, clinicId: string): void {
  if (!objectPath.startsWith(`${clinicId}/`)) {
    throw new Error('STORAGE_PATH_CLINIC_MISMATCH');
  }
}
