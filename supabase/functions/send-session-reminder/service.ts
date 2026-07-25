import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { sendSesEmail } from '../_shared/aws-ses.ts';
import type { SendSessionReminderPayload, SendSessionReminderResponse } from './types.ts';

function formatSessionDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function buildReminderEmail(params: {
  contactName: string;
  patientName: string;
  professionalName: string;
  sessionAtLabel: string;
  durationMinutes: number | null;
}): { subject: string; html: string; text: string } {
  const durationLine = params.durationMinutes
    ? `Duração prevista: ${params.durationMinutes} minutos.`
    : '';

  const subject = `Lembrete de atendimento — ${params.patientName}`;
  const text = [
    `Olá, ${params.contactName}!`,
    '',
    `Este é um lembrete do atendimento de ${params.patientName} com ${params.professionalName}.`,
    `Data e horário: ${params.sessionAtLabel}.`,
    durationLine,
    '',
    'Unithery — plataforma de acompanhamento terapêutico.',
  ].filter(Boolean).join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:Arial,sans-serif;color:#1f2a2e;line-height:1.6;">
  <p>Olá, <strong>${params.contactName}</strong>!</p>
  <p>Este é um lembrete do atendimento de <strong>${params.patientName}</strong> com <strong>${params.professionalName}</strong>.</p>
  <p><strong>Data e horário:</strong> ${params.sessionAtLabel}<br/>
  ${durationLine ? `<strong>${durationLine}</strong>` : ''}</p>
  <p style="color:#4b5a60;font-size:13px;">Enviado pela plataforma Unithery em nome do consultório/clínica.</p>
</body>
</html>`;

  return { subject, html, text };
}

export async function sendSessionReminder(
  payload: SendSessionReminderPayload,
  caller: AuthenticatedUser,
): Promise<SendSessionReminderResponse> {
  const supabase = createServiceClient();

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

  const [{ data: patient }, { data: familyContact }] = await Promise.all([
    supabase
      .from('patients')
      .select('id, name')
      .eq('id', session.patient_id)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('family_members')
      .select('name, email, phone')
      .eq('patient_id', session.patient_id)
      .is('deleted_at', null)
      .not('email', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!patient) {
    throw new AppError({
      code: 'PATIENT_NOT_FOUND',
      message: 'Paciente não encontrado',
      statusCode: 404,
    });
  }

  const recipientEmail = familyContact?.email?.trim();
  if (!recipientEmail) {
    throw new AppError({
      code: 'NO_FAMILY_EMAIL',
      message: 'Nenhum responsável com e-mail cadastrado para este paciente. Cadastre um contato familiar com e-mail.',
      statusCode: 409,
    });
  }

  const sessionAtLabel = formatSessionDateTime(session.scheduled_at as string);
  const contactName = (familyContact?.name as string)?.trim() || 'responsável';
  const emailContent = buildReminderEmail({
    contactName,
    patientName: patient.name as string,
    professionalName: (professional.name as string) || 'terapeuta',
    sessionAtLabel,
    durationMinutes: session.duration_minutes ? Number(session.duration_minutes) : null,
  });

  await sendSesEmail({
    to: recipientEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: professional.clinic_id,
    action: 'session.reminder_email',
    resource_type: 'therapist_schedule',
    resource_id: session.id,
    metadata: {
      patient_id: session.patient_id,
      sent_to: recipientEmail,
      scheduled_at: session.scheduled_at,
    },
  });

  return {
    sent_to: recipientEmail,
    contact_name: contactName,
    session_at: session.scheduled_at as string,
  };
}
