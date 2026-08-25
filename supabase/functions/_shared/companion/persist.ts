import { createServiceClient } from '../supabase.ts';
import { AppError } from '../errors.ts';
import type { ClinicalRiskLevel } from '../patient-profile.ts';
import type { RiskDetector } from './risk-merge.ts';
import { alertCopy, alertDedupeKey, brDateKey, shouldNotifyNow } from './alerts.ts';
import { notifyProfessionalOfCrisis } from './crisis-email.ts';

export interface CompanionThread {
  id: string;
  patient_id: string;
  clinic_id: string;
  portal_link_id: string | null;
  user_id: string;
}

export async function getOrCreateCompanionThread(params: {
  patientId: string;
  clinicId: string;
  userId: string;
  portalLinkId: string;
}): Promise<CompanionThread> {
  const supabase = createServiceClient();

  const { data: existing, error: readError } = await supabase
    .from('patient_copilot_threads')
    .select('id, patient_id, clinic_id, portal_link_id, user_id')
    .eq('patient_id', params.patientId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle();

  if (readError) {
    throw new AppError({ code: 'THREAD_READ_FAILED', message: readError.message, statusCode: 500 });
  }
  if (existing) return existing as CompanionThread;

  const { data: created, error: writeError } = await supabase
    .from('patient_copilot_threads')
    .insert({
      patient_id: params.patientId,
      clinic_id: params.clinicId,
      portal_link_id: params.portalLinkId,
      user_id: params.userId,
      title: 'Conversa com a Ivy',
      status: 'active',
    })
    .select('id, patient_id, clinic_id, portal_link_id, user_id')
    .single();

  if (writeError || !created) {
    throw new AppError({
      code: 'THREAD_CREATE_FAILED',
      message: writeError?.message ?? 'Falha ao abrir a conversa',
      statusCode: 500,
    });
  }

  return created as CompanionThread;
}

export async function loadRecentCompanionMessages(
  threadId: string,
  limit = 12,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('patient_copilot_messages')
    .select('role, content')
    .eq('thread_id', threadId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return [...data].reverse() as Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function insertCompanionMessage(params: {
  threadId: string;
  patientId: string;
  clinicId: string;
  role: 'user' | 'assistant';
  content: string;
  inputSource?: 'text' | 'audio';
  riskLevel: ClinicalRiskLevel;
  riskSignals: Record<string, unknown>;
  riskDetector: RiskDetector;
  emergencyProtocolShown?: boolean;
  model?: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
}): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('patient_copilot_messages')
    .insert({
      thread_id: params.threadId,
      patient_id: params.patientId,
      clinic_id: params.clinicId,
      role: params.role,
      content: params.content,
      input_source: params.inputSource ?? 'text',
      risk_level: params.riskLevel,
      risk_signals: params.riskSignals,
      risk_detector: params.riskDetector,
      emergency_protocol_shown: params.emergencyProtocolShown ?? false,
      model: params.model ?? null,
      latency_ms: params.latencyMs ?? null,
      tokens_in: params.tokensIn ?? null,
      tokens_out: params.tokensOut ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new AppError({
      code: 'MESSAGE_PERSIST_FAILED',
      message: error?.message ?? 'Falha ao gravar a mensagem',
      statusCode: 500,
    });
  }

  return data.id as string;
}

export async function raiseCompanionClinicalAlert(params: {
  patientId: string;
  clinicId: string;
  messageId: string;
  detector: RiskDetector;
  severity: 'MODERATE' | 'SEVERE';
  reportedText?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const copy = alertCopy(params.severity);
  const day = brDateKey();

  const { data: patient } = await supabase
    .from('patients')
    .select('professional_id')
    .eq('id', params.patientId)
    .maybeSingle();

  const { error } = await supabase.from('clinical_alerts').insert({
    patient_id: params.patientId,
    clinic_id: params.clinicId,
    professional_id: (patient as { professional_id?: string } | null)?.professional_id ?? null,
    source: 'COPILOT_B2C',
    severity: params.severity,
    status: 'UNREAD',
    title: copy.title,
    summary: copy.summary,
    source_ref_id: params.messageId,
    dedupe_key: alertDedupeKey(params.patientId, params.severity, day),
    metadata: {
      detector: params.detector,
      notify_now: shouldNotifyNow(params.severity),
      protocol: params.severity === 'SEVERE' ? 'emergency_v1' : 'coping_v1',
    },
  });

  if (error && error.code !== '23505') {
    console.error(JSON.stringify({
      level: 'error',
      action: 'clinical_alert_insert_failed',
      message: error.message,
      patient_id: params.patientId,
      severity: params.severity,
    }));
  }

  await notifyProfessionalOfCrisis({
    patientId: params.patientId,
    clinicId: params.clinicId,
    kind: params.severity === 'SEVERE' ? 'companion_severe' : 'companion_moderate',
    reportedText: params.reportedText ?? '',
  });
}

export async function raiseSevereClinicalAlert(params: {
  patientId: string;
  clinicId: string;
  messageId: string;
  detector: RiskDetector;
}): Promise<void> {
  await raiseCompanionClinicalAlert({ ...params, severity: 'SEVERE' });
}
