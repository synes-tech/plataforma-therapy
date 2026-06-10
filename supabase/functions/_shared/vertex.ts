/**
 * Vertex AI provider — Google Cloud (GCP) via Service Account.
 *
 * 100% Vertex AI: autenticação OAuth2 Server-to-Server (JWT RS256 assinado
 * com Web Crypto, zero dependências externas), chamadas REST ao endpoint
 * aiplatform.googleapis.com. Sem AI Studio / API Key. Áudio via inlineData
 * (base64) — sem GCS.
 *
 * Agentes: Backend (2) + IA (3) + Segurança (6).
 */

import { encodeBase64, decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

const sa: ServiceAccount = JSON.parse(
  new TextDecoder().decode(decodeBase64(Deno.env.get('GCP_SERVICE_ACCOUNT')!)),
);
const LOCATION = Deno.env.get('GCP_LOCATION') ?? 'us-central1';
const VERTEX_BASE =
  `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/${LOCATION}/publishers/google/models`;

export const CHAT_MODEL = Deno.env.get('VERTEX_CHAT_MODEL') ?? 'gemini-2.5-pro';
export const EMBED_MODEL = Deno.env.get('VERTEX_EMBED_MODEL') ?? 'gemini-embedding-001';
export const EMBED_DIMS = 768;

// ============================================================
// Types
// ============================================================
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// deno-lint-ignore no-explicit-any
type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GenerateOptions {
  model?: string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Limite de tokens de raciocínio (Gemini 2.5+). Conta dentro de maxOutputTokens. */
  thinkingBudget?: number;
  // deno-lint-ignore no-explicit-any
  responseSchema?: Record<string, any>;
}

export interface VertexGenerateResult {
  text: string;
  tokens: number;
  finishReason?: string;
  thoughtsTokens?: number;
  truncated: boolean;
}

// ============================================================
// OAuth2 — JWT (RS256) → access token (cached per isolate)
// ============================================================
let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedKey: CryptoKey | null = null;

function toB64Url(bytes: Uint8Array): string {
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function strToB64Url(str: string): string {
  return toB64Url(new TextEncoder().encode(str));
}

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const pem = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const der = decodeBase64(pem);
  cachedKey = await crypto.subtle.importKey(
    'pkcs8',
    der,
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

  const now = Math.floor(Date.now() / 1000);
  const header = strToB64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = strToB64Url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: sa.token_uri,
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

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Vertex token error ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }

  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.token;
}

// ============================================================
// Core generateContent (Vertex REST)
// ============================================================
function isThinkingModel(model: string): boolean {
  return model.includes('2.5') || model.includes('2-5');
}

async function generateContent(
  contents: { role: 'user' | 'model'; parts: Part[] }[],
  opts: GenerateOptions,
): Promise<VertexGenerateResult> {
  const model = opts.model ?? CHAT_MODEL;
  const token = await getAccessToken();

  // deno-lint-ignore no-explicit-any
  const generationConfig: Record<string, any> = {
    temperature: opts.temperature ?? 0.3,
    maxOutputTokens: opts.maxOutputTokens ?? 4096,
  };

  // Gemini 2.5 Pro: "thinking" consome maxOutputTokens antes do texto visível.
  // Sem thinkingBudget explícito, o modelo pode gastar quase todo o limite em raciocínio.
  if (isThinkingModel(model)) {
    generationConfig.thinkingConfig = {
      thinkingBudget: opts.thinkingBudget ?? 1024,
    };
  }

  if (opts.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = opts.responseSchema;
  }

  // deno-lint-ignore no-explicit-any
  const body: Record<string, any> = { contents, generationConfig };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  const res = await fetch(`${VERTEX_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Vertex generateContent ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const json = await res.json();
  const candidate = json.candidates?.[0];
  const finishReason = candidate?.finishReason as string | undefined;
  const thoughtsTokens = json.usageMetadata?.thoughtsTokenCount as number | undefined;

  // Ignora partes marcadas como "thought" — só texto visível ao usuário
  const text = (candidate?.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? '')
    .join('')
    .trim();

  const tokens = json.usageMetadata?.totalTokenCount ?? 0;
  const truncated = finishReason === 'MAX_TOKENS';

  if (!text && finishReason && finishReason !== 'STOP') {
    console.log(JSON.stringify({
      level: 'warn',
      action: 'vertex_empty_output',
      model,
      finishReason,
      thoughtsTokens,
      maxOutputTokens: generationConfig.maxOutputTokens,
    }));
    throw new Error(`Vertex finishReason=${finishReason}`);
  }

  if (truncated) {
    console.log(JSON.stringify({
      level: 'warn',
      action: 'vertex_truncated_output',
      model,
      finishReason,
      thoughtsTokens,
      outputChars: text.length,
      maxOutputTokens: generationConfig.maxOutputTokens,
    }));
  }

  return { text, tokens, finishReason, thoughtsTokens, truncated };
}

// ============================================================
// Chat (conversational)
// ============================================================
export async function vertexChat(
  messages: ChatMessage[],
  opts: GenerateOptions = {},
): Promise<VertexGenerateResult> {
  const contents = messages.map((m) => ({
    role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
    parts: [{ text: m.content }] as Part[],
  }));
  return generateContent(contents, opts);
}

// ============================================================
// Structured JSON output (responseSchema)
// ============================================================
export async function vertexJSON<T>(
  parts: Part[],
  opts: GenerateOptions,
): Promise<{ data: T; tokens: number }> {
  const { text, tokens, truncated } = await generateContent([{ role: 'user', parts }], opts);
  if (truncated) {
    throw new Error('Vertex JSON output truncated (MAX_TOKENS)');
  }
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Vertex did not return valid JSON');
    data = JSON.parse(match[0]) as T;
  }
  return { data, tokens };
}

// ============================================================
// Embeddings (Vertex :predict, 768d, L2-normalized)
// ============================================================
function l2normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

export async function vertexEmbed(
  texts: string[],
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT',
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const token = await getAccessToken();

  const res = await fetch(`${VERTEX_BASE}/${EMBED_MODEL}:predict`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: texts.map((content) => ({ content, task_type: taskType })),
      parameters: { outputDimensionality: EMBED_DIMS },
    }),
  });

  if (!res.ok) {
    throw new Error(`Vertex embeddings ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const json = await res.json();
  return (json.predictions ?? []).map((p: { embeddings: { values: number[] } }) =>
    l2normalize(p.embeddings.values),
  );
}

export async function vertexEmbedSingle(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_QUERY',
): Promise<number[]> {
  const [vec] = await vertexEmbed([text], taskType);
  return vec;
}

// ============================================================
// Audio → structured (inlineData base64, sem GCS)
// ============================================================
export async function vertexAudioToStructured<T>(
  bytes: Uint8Array,
  mimeType: string,
  prompt: string,
  // deno-lint-ignore no-explicit-any
  responseSchema: Record<string, any>,
  opts: GenerateOptions = {},
): Promise<{ data: T; tokens: number }> {
  const parts: Part[] = [
    { inlineData: { mimeType, data: encodeBase64(bytes) } },
    { text: prompt },
  ];
  return vertexJSON<T>(parts, { ...opts, responseSchema });
}
