import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { sendSesEmail } from './aws-ses.ts';
import {
  resolveSessionEmailRecipients,
  type PatientContactRow,
  type SessionEmailRecipient,
} from './session-email-recipients.ts';
import {
  buildSessionEmailContent,
  type SessionEmailKind,
} from './session-email-templates.ts';

const PATIENT_CONTACT_SELECT =
  'id, name, contact_scope, email_paciente, telefone_paciente, email_responsavel, telefone_responsavel, nome_responsavel';

export async function loadPatientContact(
  supabase: SupabaseClient,
  patientId: string,
): Promise<PatientContactRow | null> {
  const { data } = await supabase
    .from('patients')
    .select(PATIENT_CONTACT_SELECT)
    .eq('id', patientId)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as PatientContactRow | null) ?? null;
}

export async function loadFamilyEmailFallback(
  supabase: SupabaseClient,
  patientId: string,
): Promise<{ name: string | null; email: string | null; phone: string | null } | null> {
  const { data } = await supabase
    .from('family_members')
    .select('name, email, phone')
    .eq('patient_id', patientId)
    .is('deleted_at', null)
    .not('email', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function resolveRecipientsForPatient(
  supabase: SupabaseClient,
  patientId: string,
): Promise<{ patient: PatientContactRow; recipients: SessionEmailRecipient[] } | null> {
  const patient = await loadPatientContact(supabase, patientId);
  if (!patient) return null;
  const family = await loadFamilyEmailFallback(supabase, patientId);
  const recipients = resolveSessionEmailRecipients(patient, family);
  return { patient, recipients };
}

export async function enqueueSessionEmailJobs(params: {
  supabase: SupabaseClient;
  scheduleId: string;
  patientId: string;
  clinicId: string;
  professionalId: string;
  kind: SessionEmailKind;
  sendAt: Date;
  recipients: SessionEmailRecipient[];
  metadata?: Record<string, unknown>;
}): Promise<number> {
  if (params.recipients.length === 0) return 0;

  const rows = params.recipients.map((r) => ({
    schedule_id: params.scheduleId,
    patient_id: params.patientId,
    clinic_id: params.clinicId,
    professional_id: params.professionalId,
    kind: params.kind,
    send_at: params.sendAt.toISOString(),
    status: 'pending',
    recipient_email: r.email,
    recipient_name: r.name,
    recipient_role: r.role,
    metadata: params.metadata ?? {},
  }));

  let inserted = 0;
  for (const row of rows) {
    const { error: insertError } = await params.supabase.from('session_email_jobs').insert(row);
    if (!insertError) {
      inserted += 1;
      continue;
    }
    const msg = String(insertError.message ?? insertError.code ?? '').toLowerCase();
    if (!msg.includes('duplicate') && insertError.code !== '23505') {
      console.error('[session-email-jobs] insert failed', insertError.message);
    }
  }
  return inserted;
}

export async function cancelPendingAutoReminders(
  supabase: SupabaseClient,
  scheduleId: string,
  kinds: SessionEmailKind[] = ['reminder_24h'],
): Promise<void> {
  await supabase
    .from('session_email_jobs')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('schedule_id', scheduleId)
    .in('kind', kinds)
    .eq('status', 'pending');
}

export function computeReminder24hSendAt(scheduledAtIso: string, now = new Date()): Date | null {
  const scheduledAt = new Date(scheduledAtIso).getTime();
  if (Number.isNaN(scheduledAt) || scheduledAt <= now.getTime()) return null;

  const twentyFourH = scheduledAt - 24 * 60 * 60 * 1000;
  if (twentyFourH > now.getTime()) return new Date(twentyFourH);

  // Sessão em menos de 24h: ainda envia lembrete logo (fila imediata),
  // desde que falte mais de 1h para o atendimento.
  if (scheduledAt - now.getTime() > 60 * 60 * 1000) {
    return new Date(now.getTime() + 60_000);
  }
  return null;
}

export async function sendSessionEmailNow(params: {
  kind: SessionEmailKind;
  recipient: SessionEmailRecipient;
  patientName: string;
  professionalName: string;
  sessionAtIso: string;
  durationMinutes: number | null;
  previousSessionAtIso?: string | null;
  audience?: 'contact' | 'professional';
}): Promise<void> {
  const content = buildSessionEmailContent({
    kind: params.kind,
    contactName: params.recipient.name,
    patientName: params.patientName,
    professionalName: params.professionalName,
    sessionAtIso: params.sessionAtIso,
    durationMinutes: params.durationMinutes,
    previousSessionAtIso: params.previousSessionAtIso,
    audience: params.audience,
  });

  await sendSesEmail({
    to: params.recipient.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
}

/** Envia confirmação imediata e enfileira lembrete 24h. */
export async function notifySessionScheduled(params: {
  supabase: SupabaseClient;
  scheduleId: string;
  patientId: string;
  clinicId: string;
  professionalId: string;
  professionalName: string;
  scheduledAtIso: string;
  durationMinutes: number | null;
}): Promise<{ confirmation_sent: number; reminder_24h_queued: number }> {
  const resolved = await resolveRecipientsForPatient(params.supabase, params.patientId);
  if (!resolved || resolved.recipients.length === 0) {
    return { confirmation_sent: 0, reminder_24h_queued: 0 };
  }

  let confirmationSent = 0;
  for (const recipient of resolved.recipients) {
    try {
      await sendSessionEmailNow({
        kind: 'booking_confirmation',
        recipient,
        patientName: resolved.patient.name,
        professionalName: params.professionalName,
        sessionAtIso: params.scheduledAtIso,
        durationMinutes: params.durationMinutes,
      });
      confirmationSent += 1;

      await params.supabase.from('session_email_jobs').insert({
        schedule_id: params.scheduleId,
        patient_id: params.patientId,
        clinic_id: params.clinicId,
        professional_id: params.professionalId,
        kind: 'booking_confirmation',
        send_at: new Date().toISOString(),
        status: 'sent',
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        recipient_role: recipient.role,
        sent_at: new Date().toISOString(),
        attempts: 1,
        metadata: { channel: 'ses', trigger: 'create-schedule' },
      });
    } catch (err) {
      console.error('[notifySessionScheduled] confirmation failed', err);
      await params.supabase.from('session_email_jobs').insert({
        schedule_id: params.scheduleId,
        patient_id: params.patientId,
        clinic_id: params.clinicId,
        professional_id: params.professionalId,
        kind: 'booking_confirmation',
        send_at: new Date().toISOString(),
        status: 'failed',
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        recipient_role: recipient.role,
        attempts: 1,
        last_error: err instanceof Error ? err.message : 'SES send failed',
        metadata: { channel: 'ses', trigger: 'create-schedule' },
      });
    }
  }

  const sendAt24h = computeReminder24hSendAt(params.scheduledAtIso);
  let reminderQueued = 0;
  if (sendAt24h) {
    reminderQueued = await enqueueSessionEmailJobs({
      supabase: params.supabase,
      scheduleId: params.scheduleId,
      patientId: params.patientId,
      clinicId: params.clinicId,
      professionalId: params.professionalId,
      kind: 'reminder_24h',
      sendAt: sendAt24h,
      recipients: resolved.recipients,
      metadata: { channel: 'ses', trigger: 'create-schedule' },
    });
  }

  return { confirmation_sent: confirmationSent, reminder_24h_queued: reminderQueued };
}

export async function requeueReminder24hAfterReschedule(params: {
  supabase: SupabaseClient;
  scheduleId: string;
  patientId: string;
  clinicId: string;
  professionalId: string;
  scheduledAtIso: string;
}): Promise<number> {
  await cancelPendingAutoReminders(params.supabase, params.scheduleId, ['reminder_24h']);
  const resolved = await resolveRecipientsForPatient(params.supabase, params.patientId);
  if (!resolved || resolved.recipients.length === 0) return 0;

  const sendAt = computeReminder24hSendAt(params.scheduledAtIso);
  if (!sendAt) return 0;

  return enqueueSessionEmailJobs({
    supabase: params.supabase,
    scheduleId: params.scheduleId,
    patientId: params.patientId,
    clinicId: params.clinicId,
    professionalId: params.professionalId,
    kind: 'reminder_24h',
    sendAt,
    recipients: resolved.recipients,
    metadata: { channel: 'ses', trigger: 'reschedule-session' },
  });
}

/** Aviso imediato de reagendamento para contatos do paciente + profissional. */
export async function notifySessionRescheduled(params: {
  supabase: SupabaseClient;
  scheduleId: string;
  patientId: string;
  clinicId: string;
  professionalId: string;
  professionalName: string;
  professionalEmail: string | null;
  previousScheduledAtIso: string;
  scheduledAtIso: string;
  durationMinutes: number | null;
}): Promise<{ contact_sent: number; professional_sent: number }> {
  const resolved = await resolveRecipientsForPatient(params.supabase, params.patientId);
  let contactSent = 0;
  let professionalSent = 0;

  const recipients = resolved?.recipients ?? [];
  for (const recipient of recipients) {
    try {
      await sendSessionEmailNow({
        kind: 'reschedule_notice',
        audience: 'contact',
        recipient,
        patientName: resolved!.patient.name,
        professionalName: params.professionalName,
        sessionAtIso: params.scheduledAtIso,
        previousSessionAtIso: params.previousScheduledAtIso,
        durationMinutes: params.durationMinutes,
      });
      contactSent += 1;
      await params.supabase.from('session_email_jobs').insert({
        schedule_id: params.scheduleId,
        patient_id: params.patientId,
        clinic_id: params.clinicId,
        professional_id: params.professionalId,
        kind: 'reschedule_notice',
        send_at: new Date().toISOString(),
        status: 'sent',
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        recipient_role: recipient.role,
        sent_at: new Date().toISOString(),
        attempts: 1,
        metadata: {
          channel: 'ses',
          trigger: 'reschedule-session',
          previous_scheduled_at: params.previousScheduledAtIso,
          new_scheduled_at: params.scheduledAtIso,
          audience: 'contact',
        },
      });
    } catch (err) {
      console.error('[notifySessionRescheduled] contact send failed', err);
      await params.supabase.from('session_email_jobs').insert({
        schedule_id: params.scheduleId,
        patient_id: params.patientId,
        clinic_id: params.clinicId,
        professional_id: params.professionalId,
        kind: 'reschedule_notice',
        send_at: new Date().toISOString(),
        status: 'failed',
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        recipient_role: recipient.role,
        attempts: 1,
        last_error: err instanceof Error ? err.message : 'SES send failed',
        metadata: {
          channel: 'ses',
          trigger: 'reschedule-session',
          previous_scheduled_at: params.previousScheduledAtIso,
          new_scheduled_at: params.scheduledAtIso,
          audience: 'contact',
        },
      });
    }
  }

  const proEmail = params.professionalEmail?.trim().toLowerCase() ?? '';
  if (proEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proEmail)) {
    const alreadySentToPro = recipients.some((r) => r.email === proEmail);
    if (!alreadySentToPro) {
      const proRecipient = {
        email: proEmail,
        name: params.professionalName || 'Profissional',
        role: 'professional' as const,
      };
      try {
        await sendSessionEmailNow({
          kind: 'reschedule_notice',
          audience: 'professional',
          recipient: proRecipient,
          patientName: resolved?.patient.name ?? 'Paciente',
          professionalName: params.professionalName,
          sessionAtIso: params.scheduledAtIso,
          previousSessionAtIso: params.previousScheduledAtIso,
          durationMinutes: params.durationMinutes,
        });
        professionalSent = 1;
        await params.supabase.from('session_email_jobs').insert({
          schedule_id: params.scheduleId,
          patient_id: params.patientId,
          clinic_id: params.clinicId,
          professional_id: params.professionalId,
          kind: 'reschedule_notice',
          send_at: new Date().toISOString(),
          status: 'sent',
          recipient_email: proRecipient.email,
          recipient_name: proRecipient.name,
          recipient_role: 'professional',
          sent_at: new Date().toISOString(),
          attempts: 1,
          metadata: {
            channel: 'ses',
            trigger: 'reschedule-session',
            previous_scheduled_at: params.previousScheduledAtIso,
            new_scheduled_at: params.scheduledAtIso,
            audience: 'professional',
          },
        });
      } catch (err) {
        console.error('[notifySessionRescheduled] professional send failed', err);
        await params.supabase.from('session_email_jobs').insert({
          schedule_id: params.scheduleId,
          patient_id: params.patientId,
          clinic_id: params.clinicId,
          professional_id: params.professionalId,
          kind: 'reschedule_notice',
          send_at: new Date().toISOString(),
          status: 'failed',
          recipient_email: proRecipient.email,
          recipient_name: proRecipient.name,
          recipient_role: 'professional',
          attempts: 1,
          last_error: err instanceof Error ? err.message : 'SES send failed',
          metadata: {
            channel: 'ses',
            trigger: 'reschedule-session',
            previous_scheduled_at: params.previousScheduledAtIso,
            new_scheduled_at: params.scheduledAtIso,
            audience: 'professional',
          },
        });
      }
    } else {
      // Mesmo e-mail já recebeu versão "contact"; conta como enviado ao profissional também.
      professionalSent = 1;
    }
  }

  return { contact_sent: contactSent, professional_sent: professionalSent };
}
