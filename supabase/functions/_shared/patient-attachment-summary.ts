import { vertexChat } from './vertex.ts';

const MAX_INPUT_CHARS = 100_000;

export async function summarizePatientAttachmentText(
  extractedText: string,
  fileName: string,
): Promise<string> {
  const trimmed = extractedText.trim();
  if (!trimmed) {
    return 'Não foi possível extrair texto legível deste documento para gerar um resumo.';
  }

  const input =
    trimmed.length > MAX_INPUT_CHARS
      ? `${trimmed.slice(0, MAX_INPUT_CHARS)}\n\n[... documento truncado para processamento ...]`
      : trimmed;

  const result = await vertexChat(
    [{ role: 'user', content: `Arquivo: ${fileName}\n\nConteúdo extraído:\n${input}` }],
    {
      system: [
        'Você é assistente clínico da plataforma Unithery.',
        'Resuma o documento anexo de forma objetiva em português brasileiro para o terapeuta.',
        'Inclua, quando presentes no texto: contexto principal, queixas/hipóteses, achados relevantes,',
        'recomendações ou condutas, medicações citadas e pontos de atenção para o acompanhamento.',
        'Use markdown leve (títulos curtos e bullet points). Máximo 350 palavras.',
        'Não invente informações que não estejam no documento.',
      ].join(' '),
      temperature: 0.2,
      maxOutputTokens: 1200,
    },
  );

  const summary = result.text.trim();
  return summary || 'Resumo indisponível para este documento.';
}
