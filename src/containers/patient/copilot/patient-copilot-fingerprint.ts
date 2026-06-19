export function normalizeArtifactText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export async function artifactFingerprint(text: string): Promise<string> {
  const normalized = normalizeArtifactText(text);
  const data = new TextEncoder().encode(normalized);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function artifactSaveKey(fingerprint: string, tipo: string): string {
  return `${fingerprint}:${tipo}`;
}
