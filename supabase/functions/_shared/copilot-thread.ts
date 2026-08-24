import { AppError, ForbiddenError } from './errors.ts';
import type { AuthenticatedUser } from './auth.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export interface OwnedPatientAccess {
  patientId: string;
  patientName: string;
  clinicId: string;
  professionalId: string;
}

export interface CopilotThreadRow {
  id: string;
  clinic_id: string;
  professional_id: string;
  patient_id: string;
}

export interface CopilotPersistedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  input_source: 'text' | 'audio';
  sources: unknown[];
  guardrail_triggered: boolean;
  answer_incomplete: boolean;
  created_at: string;
}

export interface PersistCopilotTurnInput {
  patientId: string;
  userContent: string;
  assistantContent: string;
  inputSource?: 'text' | 'audio';
  sources?: unknown[];
  guardrailTriggered?: boolean;
  answerIncomplete?: boolean;
}

const PATIENT_ACCESS_SELECT = 'id, name, clinic_id, professional_id';

export async function resolveOwnedPatient(
  supabase: SupabaseClient,
  caller: AuthenticatedUser,
  patientId: string,
): Promise<OwnedPatientAccess> {
  const { data: patient, error } = await supabase
    .from('patients')
    .select(PATIENT_ACCESS_SELECT)
    .eq('id', patientId)
    .is('deleted_at', null)
    .single();

  if (error || !patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('id, clinic_id')
    .eq('user_id', caller.id)
    .eq('id', patient.professional_id)
    .is('deleted_at', null)
    .single();

  if (!professional) {
    throw new ForbiddenError('Você não tem acesso a este paciente');
  }

  if (caller.clinic_id && patient.clinic_id !== caller.clinic_id) {
    throw new ForbiddenError('Você não tem acesso a este paciente');
  }

  return {
    patientId: patient.id,
    patientName: patient.name,
    clinicId: patient.clinic_id,
    professionalId: professional.id,
  };
}

export async function getOrCreateActiveThread(
  supabase: SupabaseClient,
  access: OwnedPatientAccess,
  createdBy: string,
): Promise<CopilotThreadRow> {
  const { data: existing } = await supabase
    .from('copilot_threads')
    .select('id, clinic_id, professional_id, patient_id')
    .eq('professional_id', access.professionalId)
    .eq('patient_id', access.patientId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) return existing as CopilotThreadRow;

  const { data: created, error } = await supabase
    .from('copilot_threads')
    .insert({
      clinic_id: access.clinicId,
      professional_id: access.professionalId,
      patient_id: access.patientId,
      created_by: createdBy,
    })
    .select('id, clinic_id, professional_id, patient_id')
    .single();

  if (error || !created) {
    const { data: raced } = await supabase
      .from('copilot_threads')
      .select('id, clinic_id, professional_id, patient_id')
      .eq('professional_id', access.professionalId)
      .eq('patient_id', access.patientId)
      .is('deleted_at', null)
      .maybeSingle();
    if (raced) return raced as CopilotThreadRow;
    throw new AppError({
      code: 'THREAD_CREATE_FAILED',
      message: error?.message ?? 'Não foi possível abrir a conversa',
      statusCode: 500,
    });
  }

  return created as CopilotThreadRow;
}

export async function listThreadMessages(
  supabase: SupabaseClient,
  threadId: string,
  limit = 80,
): Promise<CopilotPersistedMessage[]> {
  const { data, error } = await supabase
    .from('copilot_messages')
    .select('id, role, content, input_source, sources, guardrail_triggered, answer_incomplete, created_at')
    .eq('thread_id', threadId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new AppError({
      code: 'THREAD_FETCH_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }

  return (data ?? []) as CopilotPersistedMessage[];
}

export async function persistCopilotTurn(
  supabase: SupabaseClient,
  caller: AuthenticatedUser,
  input: PersistCopilotTurnInput,
): Promise<void> {
  const access = await resolveOwnedPatient(supabase, caller, input.patientId);
  const thread = await getOrCreateActiveThread(supabase, access, caller.id);
  const now = new Date().toISOString();

  const { error } = await supabase.from('copilot_messages').insert([
    {
      thread_id: thread.id,
      clinic_id: access.clinicId,
      patient_id: access.patientId,
      role: 'user',
      content: input.userContent,
      input_source: input.inputSource ?? 'text',
      sources: [],
      created_by: caller.id,
      created_at: now,
    },
    {
      thread_id: thread.id,
      clinic_id: access.clinicId,
      patient_id: access.patientId,
      role: 'assistant',
      content: input.assistantContent,
      input_source: 'text',
      sources: input.sources ?? [],
      guardrail_triggered: input.guardrailTriggered ?? false,
      answer_incomplete: input.answerIncomplete ?? false,
      created_by: caller.id,
      created_at: new Date(Date.parse(now) + 1).toISOString(),
    },
  ]);

  if (error) {
    throw new AppError({
      code: 'THREAD_PERSIST_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }

  await supabase
    .from('copilot_threads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', thread.id)
    .is('deleted_at', null);
}

export async function resetActiveThread(
  supabase: SupabaseClient,
  caller: AuthenticatedUser,
  patientId: string,
): Promise<CopilotThreadRow> {
  const access = await resolveOwnedPatient(supabase, caller, patientId);
  const { data: current } = await supabase
    .from('copilot_threads')
    .select('id')
    .eq('professional_id', access.professionalId)
    .eq('patient_id', access.patientId)
    .is('deleted_at', null)
    .maybeSingle();

  if (current?.id) {
    const stamped = new Date().toISOString();
    await supabase
      .from('copilot_messages')
      .update({ deleted_at: stamped })
      .eq('thread_id', current.id)
      .is('deleted_at', null);
    await supabase
      .from('copilot_threads')
      .update({ deleted_at: stamped })
      .eq('id', current.id)
      .is('deleted_at', null);
  }

  return getOrCreateActiveThread(supabase, access, caller.id);
}
