import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import {
  enqueueSessionEmailJobs,
  resolveRecipientsForPatient,
  sendSessionEmailNow,
} from '../_shared/session-email-jobs.ts';
import type { SendSessionReminderPayload, SendSessionReminderResponse } from './types.ts';

export async function sendSessionReminder(
  payload: SendSessionReminderPayload,
  caller: AuthenticatedUser,
): Promise<SendSessionReminderResponse> {
  const supabase = createServiceClient();
  const mode = payload.mode ?? 'now';

  const { data: professional, error: profError } = await supabase
    .from('professionals')
    .select('id, name, clinic_id')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .single();

  if (profError || !professional) {
    throw new ForbiddenError('Profissional não encontrado');
  }

  const { data: session, error: sessionError } = await supabase
    .from('therapist_schedule')
    .select('id, patient_id, title, scheduled_at, duration_minutes, status, professional_id')
    .eq('id', payload.session_id)
    .eq('professional_id', professional.id)
    .is('deleted_at', null)
    .single();

  if (sessionError || !session) {
    throw new AppError({
      code: 'SESSION_NOT_FOUND',
      message: 'Sessão não encontrada',
      statusCode: 404,
    });
  }

  if (['completed', 'cancelled', 'canceled', 'no_show', 'not_completed'].includes(session.status as string)) {
    throw new AppError({
      code: 'SESSION_NOT_REMINDABLE',
      message: 'Não é possível enviar lembrete para uma sessão já encerrada ou cancelada.',
      statusCode: 409,
    });
  }

  if (!session.patient_id) {
    throw new AppError({
      code: 'SESSION_NO_PATIENT',
      message: 'Esta sessão não está vinculada a um paciente.',
      statusCode: 409,
    });
  }

  const resolved = await resolveRecipientsForPatient(supabase, session.patient_id as string);
  if (!resolved || resolved.recipients.length === 0) {
    throw new AppError({
      code: 'NO_CONTACT_EMAIL',
      message:
        'Nenhum e-mail de contato cadastrado para este paciente. Inclua e-mail do paciente ou do responsável no cadastro.',
      statusCode: 409,
    });
  }

  if (mode === 'at') {
    const sendAtRaw = payload.send_at;
    if (!sendAtRaw) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Informe send_at (ISO 8601) para agendar o lembrete.',
        statusCode: 400,
      });
    }
    const sendAt = new Date(sendAtRaw);
    if (Number.isNaN(sendAt.getTime())) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'send_at inválido.',
        statusCode: 400,
      });
    }
    if (sendAt.getTime() < Date.now() - 60_000) {
      throw new AppError({
        code: 'PAST_DATE',
        message: 'Não é possível agendar lembrete no passado.',
        statusCode: 400,
      });
    }
    if (sendAt.getTime() >= new Date(session.scheduled_at as string).getTime()) {
      throw new AppError({
        code: 'INVALID_SEND_AT',
        message: 'O lembrete precisa ser anterior ao horário da sessão.',
        statusCode: 400,
      });
    }

    const queued = await enqueueSessionEmailJobs({
      supabase,
      scheduleId: session.id as string,
      patientId: session.patient_id as string,
      clinicId: professional.clinic_id as string,
      professionalId: professional.id as string,
      kind: 'reminder_manual',
      sendAt,
      recipients: resolved.recipients,
      metadata: { channel: 'ses', trigger: 'send-session-reminder', mode: 'at' },
    });

    await supabase.from('audit_logs').insert({
      user_id: caller.id,
      clinic_id: professional.clinic_id,
      action: 'session.reminder_email_scheduled',
      resource_type: 'therapist_schedule',
      resource_id: session.id,
      metadata: {
        patient_id: session.patient_id,
        send_at: sendAt.toISOString(),
        recipients: resolved.recipients.map((r) => r.email),
        queued,
      },
    });

    return {
      mode: 'at',
      queued,
      send_at: sendAt.toISOString(),
      sent_to: resolved.recipients.map((r) => r.email).join(', '),
      contact_name: resolved.recipients.map((r) => r.name).join(', '),
      session_at: session.scheduled_at as string,
    };
  }

  const sentTo: string[] = [];
  for (const recipient of resolved.recipients) {
    await sendSessionEmailNow({
      kind: 'reminder_manual',
      recipient,
      patientName: resolved.patient.name,
      professionalName: (professional.name as string) || 'terapeuta',
      sessionAtIso: session.scheduled_at as string,
      durationMinutes: session.duration_minutes ? Number(session.duration_minutes) : null,
    });
    sentTo.push(recipient.email);

    await supabase.from('session_email_jobs').insert({
      schedule_id: session.id,
      patient_id: session.patient_id,
      clinic_id: professional.clinic_id,
      professional_id: professional.id,
      kind: 'reminder_manual',
      send_at: new Date().toISOString(),
      status: 'sent',
      recipient_email: recipient.email,
      recipient_name: recipient.name,
      recipient_role: recipient.role,
      sent_at: new Date().toISOString(),
      attempts: 1,
      metadata: { channel: 'ses', trigger: 'send-session-reminder', mode: 'now' },
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: professional.clinic_id,
    action: 'session.reminder_email',
    resource_type: 'therapist_schedule',
    resource_id: session.id,
    metadata: {
      patient_id: session.patient_id,
      sent_to: sentTo,
      scheduled_at: session.scheduled_at,
    },
  });

  return {
    mode: 'now',
    sent_to: sentTo.join(', '),
    contact_name: resolved.recipients.map((r) => r.name).join(', '),
    session_at: session.scheduled_at as string,
  };
}
