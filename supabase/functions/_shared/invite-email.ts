import { sendSesEmail } from './aws-ses.ts';
import { createServiceClient } from './supabase.ts';
import { buildPortalInviteEmail, formatExpiryLabel } from './invite-email-templates.ts';
import type { PortalAccessLevel } from './patient-profile.ts';

function portalUrl(): string {
  const base = Deno.env.get('PUBLIC_APP_URL')?.replace(/\/+$/, '') || 'https://www.unithery.com';
  return `${base}/invite`;
}

/**
 * Envia o convite do portal e registra o resultado no próprio convite.
 *
 * Nunca lança: o cadastro do paciente já está salvo quando esta função roda, e uma
 * indisponibilidade do SES não pode derrubar um cadastro concluído. A falha fica gravada
 * em invites.send_error para reenvio, e o terapeuta continua com o código na tela.
 */
export async function sendPortalInviteEmail(params: {
  inviteId: string;
  code: string;
  to: string;
  recipientName: string;
  patientName: string;
  professionalName: string;
  accessLevel: PortalAccessLevel;
  expiresInHours?: number;
}): Promise<boolean> {
  const supabase = createServiceClient();

  try {
    const content = buildPortalInviteEmail(params.accessLevel, {
      recipientName: params.recipientName,
      patientName: params.patientName,
      professionalName: params.professionalName,
      code: params.code,
      portalUrl: portalUrl(),
      expiresLabel: formatExpiryLabel(params.expiresInHours ?? 168),
    });

    await sendSesEmail({
      to: params.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    await supabase
      .from('invites')
      .update({ sent_at: new Date().toISOString(), send_error: null })
      .eq('id', params.inviteId);

    console.log(
      `[invite-email] sent invite=${params.inviteId} level=${params.accessLevel} to=${params.to}`,
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[invite-email] failed invite=${params.inviteId}: ${message}`);

    await supabase
      .from('invites')
      .update({ send_error: message.slice(0, 500) })
      .eq('id', params.inviteId)
      .then(() => undefined, () => undefined);

    return false;
  }
}
