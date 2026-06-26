import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { vertexJSON, CHAT_MODEL } from '../_shared/vertex.ts';
import {
  buildSummaryMarkdown,
  buildTextOnlySoapPrompt,
  SOAP_RESPONSE_SCHEMA,
  type StructuredSessionReport,
} from '../_shared/session-report-prompts.ts';
import { persistSessionDraft } from '../_shared/session-note-pipeline.ts';
import type { ProcessSessionTextPayload, ProcessSessionTextResponse } from './types.ts';

async function assertScheduleForPatient(
  scheduleId: string | undefined,
  patientId: string,
  professionalId: string,
): Promise<string | null> {
  if (!scheduleId) return null;

  const supabase = createServiceClient();
  const { data: schedule } = await supabase
    .from('therapist_schedule')
    .select('id, patient_id, status, professional_id, started_at')
    .eq('id', scheduleId)
    .eq('professional_id', professionalId)
    .is('deleted_at', null)
    .single();

  if (!schedule || schedule.patient_id !== patientId) {
    throw new ForbiddenError('Agendamento inválido para este paciente.');
  }

  if (schedule.status === 'cancelled' || schedule.status === 'no_show') {
    throw new AppError({
      code: 'INVALID_SCHEDULE',
      message: 'Não é possível registrar sessão em agendamento cancelado.',
      statusCode: 400,
    });
  }

  if (schedule.status === 'completed') {
    throw new AppError({
      code: 'SCHEDULE_COMPLETED',
      message: 'Este agendamento já foi concluído.',
      statusCode: 409,
    });
  }

  if (schedule.status === 'scheduled' || schedule.status === 'not_completed') {
    await supabase
      .from('therapist_schedule')
      .update({
        status: 'in_progress',
        ...(schedule.started_at ? {} : { started_at: new Date().toISOString() }),
      })
      .eq('id', schedule.id);
  }

  return schedule.id;
}

export async function processSessionText(
  payload: ProcessSessionTextPayload,
  caller: AuthenticatedUser,
): Promise<ProcessSessionTextResponse> {
  const supabase = createServiceClient();
  const ctx = await verifyProfessionalPatientWrite(payload.patient_id, caller);
  const scheduleId = await assertScheduleForPatient(
    payload.schedule_id,
    ctx.patient_id,
    ctx.caller_professional_id,
  );

  const annotations = payload.anotacoes_texto.trim();
  let jobId = payload.job_id;

  if (jobId) {
    await supabase
      .from('ai_jobs')
      .update({ status: 'processing', started_at: new Date().toISOString(), attempts: 1 })
      .eq('id', jobId);
  } else {
    const { data: job, error: jobError } = await supabase
      .from('ai_jobs')
      .insert({
        patient_id: ctx.patient_id,
        clinic_id: ctx.clinic_id,
        professional_id: ctx.caller_professional_id,
        job_type: 'session_text',
        status: 'processing',
        started_at: new Date().toISOString(),
        input_data: {
          patient_id: ctx.patient_id,
          schedule_id: scheduleId,
          input_mode: 'text',
        },
      })
      .select('id')
      .single();

    if (jobError || !job) {
      throw new AppError({
        code: 'JOB_CREATE_FAILED',
        message: jobError?.message ?? 'Falha ao criar job',
        statusCode: 500,
      });
    }
    jobId = job.id;
  }

  const startTime = Date.now();

  try {
    const prompt = buildTextOnlySoapPrompt(annotations);
    const { data: structured, tokens } = await vertexJSON<StructuredSessionReport>(
      [{ text: prompt }],
      {
        model: CHAT_MODEL,
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseSchema: SOAP_RESPONSE_SCHEMA,
      },
    );

    const latencyMs = Date.now() - startTime;
    const summaryMarkdown = structured.summary_markdown?.trim() || buildSummaryMarkdown(structured);

    const { session_note_id, embeddings_count } = await persistSessionDraft({
      patient_id: ctx.patient_id,
      professional_id: ctx.caller_professional_id,
      clinic_id: ctx.clinic_id,
      schedule_id: scheduleId,
      structured: { ...structured, summary_markdown: summaryMarkdown },
      anotacoes_texto: annotations,
      input_mode: 'text',
      llm_model: CHAT_MODEL,
      llm_tokens_used: tokens,
      llm_latency_ms: latencyMs,
    });

    await supabase
      .from('ai_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        output_data: {
          session_note_id,
          embeddings_count,
          input_mode: 'text',
        },
      })
      .eq('id', jobId);

    await supabase.from('audit_logs').insert({
      user_id: caller.id,
      clinic_id: ctx.clinic_id,
      action: 'session_text.processed',
      resource_type: 'session_note',
      resource_id: session_note_id,
      metadata: {
        patient_id: ctx.patient_id,
        schedule_id: scheduleId,
        input_mode: 'text',
      },
    });

    return {
      session_note_id,
      job_id: jobId,
      embeddings_count,
      input_mode: 'text',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await supabase
      .from('ai_jobs')
      .update({ status: 'failed', error_message: message })
      .eq('id', jobId);
    throw error;
  }
}
