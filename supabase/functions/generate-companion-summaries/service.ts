import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import {
  COMPANION_SUMMARY_MODEL,
  EMBED_MODEL,
  vertexChat,
  vertexEmbedSingle,
} from '../_shared/vertex.ts';
import {
  COMPANION_SUMMARY_SYSTEM,
  buildSummaryUserPrompt,
  previousBrWeekBounds,
  sanitizeCompanionSummary,
  type CompanionTurn,
} from '../_shared/companion/summary-guardrails.ts';
import type { GenerateCompanionSummariesPayload } from './schema.ts';
import type { GenerateCompanionSummariesResponse } from './types.ts';

async function patientAllowsSharing(patientId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('patient_allows_summary_sharing', {
    p_patient_id: patientId,
  });
  if (error) return false;
  return data === true;
}

async function embedSummary(params: {
  patientId: string;
  clinicId: string;
  summaryId: string;
  summary: string;
  periodStart: string;
  periodEnd: string;
}): Promise<void> {
  const embedding = await vertexEmbedSingle(params.summary, 'RETRIEVAL_DOCUMENT');
  const supabase = createServiceClient();
  const { error } = await supabase.from('patient_embeddings').insert({
    patient_id: params.patientId,
    clinic_id: params.clinicId,
    document_type: 'companion_summary',
    source_id: params.summaryId,
    content: params.summary,
    embedding: JSON.stringify(embedding),
    metadata: {
      period_start: params.periodStart,
      period_end: params.periodEnd,
      embed_model: EMBED_MODEL,
      origin: 'companion_clinical_summary',
    },
  });
  if (error) {
    throw new AppError({
      code: 'SUMMARY_EMBED_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }
}

async function generateOne(params: {
  patientId: string;
  clinicId: string;
  periodStart: string;
  periodEnd: string;
  turns: CompanionTurn[];
}): Promise<'generated' | 'empty'> {
  if (params.turns.filter((turn) => turn.role === 'user').length === 0) return 'empty';

  const raw = await vertexChat(
    [{ role: 'user', content: buildSummaryUserPrompt(params.turns, params.periodStart, params.periodEnd) }],
    {
      model: COMPANION_SUMMARY_MODEL,
      system: COMPANION_SUMMARY_SYSTEM,
      temperature: 0.2,
      maxOutputTokens: 512,
      thinkingBudget: 0,
    },
  );

  const summary = sanitizeCompanionSummary(raw.text, params.turns);
  const supabase = createServiceClient();
  const { data: saved, error } = await supabase
    .from('companion_clinical_summaries')
    .insert({
      patient_id: params.patientId,
      clinic_id: params.clinicId,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      summary,
      model: COMPANION_SUMMARY_MODEL,
      message_count: params.turns.length,
      tokens_used: raw.tokens,
    })
    .select('id')
    .single();

  if (error?.code === '23505') return 'generated';
  if (error || !saved) {
    throw new AppError({
      code: 'SUMMARY_SAVE_FAILED',
      message: error?.message ?? 'Falha ao gravar o resumo',
      statusCode: 500,
    });
  }

  await embedSummary({
    patientId: params.patientId,
    clinicId: params.clinicId,
    summaryId: saved.id as string,
    summary,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });

  return 'generated';
}

export async function generateCompanionSummaries(
  payload: GenerateCompanionSummariesPayload,
): Promise<GenerateCompanionSummariesResponse> {
  const fallback = previousBrWeekBounds();
  const periodStart = payload.period_start ?? fallback.start;
  const periodEnd = payload.period_end ?? fallback.end;
  const supabase = createServiceClient();

  let messageQuery = supabase
    .from('patient_copilot_messages')
    .select('patient_id, clinic_id, role, content, created_at')
    .is('deleted_at', null)
    .gte('created_at', `${periodStart}T00:00:00-03:00`)
    .lte('created_at', `${periodEnd}T23:59:59-03:00`)
    .order('created_at', { ascending: true })
    .limit(4000);

  if (payload.patient_id) {
    messageQuery = messageQuery.eq('patient_id', payload.patient_id);
  }

  const { data: rows, error } = await messageQuery;
  if (error) {
    throw new AppError({ code: 'SUMMARY_SCAN_FAILED', message: error.message, statusCode: 500 });
  }

  const byPatient = new Map<string, { clinicId: string; turns: CompanionTurn[] }>();
  for (const row of rows ?? []) {
    const patientId = row.patient_id as string;
    const current = byPatient.get(patientId) ?? { clinicId: row.clinic_id as string, turns: [] };
    current.turns.push({
      role: row.role as CompanionTurn['role'],
      content: row.content as string,
      created_at: row.created_at as string,
    });
    byPatient.set(patientId, current);
  }

  const result: GenerateCompanionSummariesResponse = {
    period_start: periodStart,
    period_end: periodEnd,
    scanned: byPatient.size,
    generated: 0,
    skipped_no_consent: 0,
    skipped_existing: 0,
    skipped_empty: 0,
    failed: 0,
  };

  for (const [patientId, group] of byPatient) {
    try {
      const allowed = await patientAllowsSharing(patientId);
      if (!allowed) {
        result.skipped_no_consent += 1;
        continue;
      }

      const { data: existing } = await supabase
        .from('companion_clinical_summaries')
        .select('id')
        .eq('patient_id', patientId)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .maybeSingle();

      if (existing) {
        result.skipped_existing += 1;
        continue;
      }

      const outcome = await generateOne({
        patientId,
        clinicId: group.clinicId,
        periodStart,
        periodEnd,
        turns: group.turns,
      });
      if (outcome === 'empty') result.skipped_empty += 1;
      else result.generated += 1;
    } catch (err) {
      result.failed += 1;
      console.error(JSON.stringify({
        level: 'error',
        action: 'companion_summary_failed',
        patient_id: patientId,
        message: err instanceof Error ? err.message : 'unknown',
      }));
    }
  }

  return result;
}
