const DEFAULT_MAX_CHARS = 1200;
const DEFAULT_OVERLAP = 150;
const MIN_CHUNK_CHARS = 40;

export interface ChunkTextOptions {
  maxChars?: number;
  overlap?: number;
  minChars?: number;
}

/** Divide texto longo em chunks para embeddings RAG. */
export function chunkTextForRag(raw: string, options: ChunkTextOptions = {}): string[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  const minChars = options.minChars ?? MIN_CHUNK_CHARS;

  const normalized = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const paragraphs = normalized.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buffer = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (buffer) {
        chunks.push(buffer.trim());
        buffer = '';
      }
      for (let index = 0; index < paragraph.length; index += maxChars - overlap) {
        const slice = paragraph.slice(index, index + maxChars).trim();
        if (slice.length >= minChars) chunks.push(slice);
      }
      continue;
    }

    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      buffer = candidate;
      continue;
    }

    if (buffer) chunks.push(buffer.trim());
    buffer = paragraph;
  }

  if (buffer.trim().length >= minChars) chunks.push(buffer.trim());
  return chunks;
}
