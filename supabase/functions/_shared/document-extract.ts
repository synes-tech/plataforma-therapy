import JSZip from 'https://esm.sh/jszip@3.10.1';
import { vertexExtractDocumentText } from './vertex.ts';

function stripXmlText(xml: string): string {
  return xml
    .replace(/<w:tab[^/]*\/>/g, '\t')
    .replace(/<w:br[^/]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    throw new Error('DOCX inválido: word/document.xml ausente');
  }
  const text = stripXmlText(documentXml);
  if (!text) throw new Error('Não foi possível extrair texto do DOCX');
  return text;
}

export async function extractDocumentText(
  bytes: Uint8Array,
  mimeType: string,
  fileName: string,
): Promise<string> {
  if (mimeType === 'text/plain') {
    const text = new TextDecoder().decode(bytes).trim();
    if (!text) throw new Error('Arquivo de texto vazio');
    return text;
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractDocxText(bytes);
  }

  if (mimeType === 'application/pdf' || mimeType === 'application/msword') {
    const result = await vertexExtractDocumentText(bytes, mimeType, fileName);
    if (!result.text) throw new Error('Documento sem texto extraível');
    return result.text;
  }

  throw new Error(`Formato não suportado: ${mimeType}`);
}
