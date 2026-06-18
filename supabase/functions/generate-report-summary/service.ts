import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { AppError, NotFoundError } from '../_shared/errors.ts';
import type { SoapContent, ReportSummaryOutput } from './types.ts';

const SUMMARY_SYSTEM_PROMPT = `Você é um assistente clínico especializado em pediatria neurodivergente (TEA/TDAH).
Receba uma evolução clínica no formato SOAP e retorne um RESUMO RÁPIDO com as seguintes diretrizes:
- Máximo de 5 bullet points
- Foco em insights clínicos acionáveis
- Linguagem objetiva e profissional
- Destaque progressos, regressões ou padrões relevantes
- Nunca inclua nomes de pacientes ou dados identificáveis no resumo

Responda APENAS com um JSON no formato: { "bullets": ["ponto 1", "ponto 2", ...] }
Não inclua explicações, markdown ou texto fora do JSON.`;

function buildUserPrompt(soap: SoapContent): string {
  return `EVOLUÇÃO CLÍNICA (SOAP):

SUBJETIVO:
${soap.subjective || '(não preenchido)'}

OBJETIVO:
${soap.objective || '(não preenchido)'}

AVALIAÇÃO:
${soap.assessment || '(não preenchido)'}

PLANO:
${soap.plan || '(não preenchido)'}

Gere o resumo rápido em bullet points.`;
}

export async function generateReportSummary(
  supabase: SupabaseClient,
  professionalId: string,
  sessionNoteId: string,
): Promise<ReportSummaryOutput> {
  // Fetch the session note (RLS will already filter by professional, but we double-check)
  const { data: note, error: noteError } = await supabase
    .from('session_notes')
    .select('id, patient_id, professional_id, content, status')
    .eq('id', sessionNoteId)
    .is('deleted_at', null)
    .single();

  if (noteError || !note) {
    throw new NotFoundError('Relatório clínico');
  }

  // Double-check ownership (defense in depth beyond RLS)
  if (note.professional_id !== professionalId) {
    throw new AppError({
      code: 'ACCESS_DENIED',
      message: 'Você não tem permissão para acessar este relatório.',
      statusCode: 403,
    });
  }

  const soap = note.content as SoapContent;
  if (!soap.subjective && !soap.objective && !soap.assessment && !soap.plan) {
    throw new AppError({
      code: 'EMPTY_REPORT',
      message: 'O relatório não possui conteúdo para resumir.',
      statusCode: 422,
    });
  }

  // Call LLM API
  const bullets = await callLLM(soap);

  return {
    session_note_id: sessionNoteId,
    summary_bullets: bullets,
    generated_at: new Date().toISOString(),
  };
}

async function callLLM(soap: SoapContent): Promise<string[]> {
  // Try OpenAI first (GPT-4o), fallback concept included
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (openaiKey) {
    return callOpenAI(openaiKey, soap);
  } else if (anthropicKey) {
    return callAnthropic(anthropicKey, soap);
  }

  throw new AppError({
    code: 'LLM_NOT_CONFIGURED',
    message: 'Nenhuma API de IA configurada. Configure OPENAI_API_KEY ou ANTHROPIC_API_KEY.',
    statusCode: 503,
  });
}

async function callOpenAI(apiKey: string, soap: SoapContent): Promise<string[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(soap) },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(JSON.stringify({ level: 'error', action: 'llm_call_failed', provider: 'openai', error: err }));
    throw new AppError({
      code: 'LLM_ERROR',
      message: 'Falha ao gerar resumo com a IA. Tente novamente.',
      statusCode: 502,
    });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  return parseBullets(content);
}

async function callAnthropic(apiKey: string, soap: SoapContent): Promise<string[]> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.3,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(soap) }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(JSON.stringify({ level: 'error', action: 'llm_call_failed', provider: 'anthropic', error: err }));
    throw new AppError({
      code: 'LLM_ERROR',
      message: 'Falha ao gerar resumo com a IA. Tente novamente.',
      statusCode: 502,
    });
  }

  const data = await response.json();
  const content = data.content?.[0]?.text ?? '';
  return parseBullets(content);
}

function parseBullets(raw: string): string[] {
  try {
    // Try to extract JSON from the response (LLM may wrap in markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*"bullets"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.bullets)) {
        return parsed.bullets.filter((b: unknown) => typeof b === 'string' && b.trim().length > 0);
      }
    }
  } catch {
    // Fallback: split by newlines that look like bullet points
  }

  // Fallback parsing: split by lines starting with - or •
  const lines = raw.split('\n').filter((l) => /^[\s]*[-•*]\s/.test(l));
  if (lines.length > 0) {
    return lines.map((l) => l.replace(/^[\s]*[-•*]\s*/, '').trim()).filter(Boolean);
  }

  // Last resort: return the full text as a single bullet
  if (raw.trim()) {
    return [raw.trim()];
  }

  throw new AppError({
    code: 'LLM_PARSE_ERROR',
    message: 'Não foi possível interpretar a resposta da IA.',
    statusCode: 502,
  });
}
