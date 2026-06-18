/** Converte markdown clínico simples em blocos de texto para o PDF. */
export interface PdfTextBlock {
  type: 'heading' | 'paragraph' | 'bullet';
  text: string;
}

export function markdownToPdfBlocks(markdown: string): PdfTextBlock[] {
  const blocks: PdfTextBlock[] = [];
  const sections = markdown.split(/\n\n+/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'heading', text: trimmed.replace(/^##\s+/, '').replace(/\*\*/g, '') });
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push({ type: 'heading', text: trimmed.replace(/^#\s+/, '').replace(/\*\*/g, '') });
      continue;
    }

    const lines = trimmed.split('\n');
    const allBullets = lines.every((l) => /^[-*•]\s/.test(l.trim()) || l.trim() === '');

    if (allBullets) {
      for (const line of lines) {
        const t = line.trim();
        if (t) {
          blocks.push({
            type: 'bullet',
            text: t.replace(/^[-*•]\s+/, '').replace(/\*\*/g, ''),
          });
        }
      }
    } else {
      blocks.push({
        type: 'paragraph',
        text: trimmed.replace(/\*\*/g, '').replace(/^[-*•]\s+/gm, '• '),
      });
    }
  }

  return blocks;
}

export function formatGender(gender: string): string {
  const map: Record<string, string> = {
    male: 'Masculino',
    female: 'Feminino',
    other: 'Outro',
    not_informed: 'Não informado',
  };
  return map[gender] ?? gender;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return 'Não informado';
  return phone.trim();
}

export function calcAge(birthDate: string): number {
  return Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

export function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'paciente';
}
