import { Webhook } from 'npm:standardwebhooks@1.0.0';
import { sendSesEmail } from '../_shared/aws-ses.ts';
import { AppError } from '../_shared/errors.ts';
import { buildAuthEmailContent } from './templates.ts';
import type { AuthSendEmailHookPayload } from './types.ts';

function getHookSecret(): string {
  const raw = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
  if (!raw) {
    throw new AppError({
      code: 'HOOK_SECRET_MISSING',
      message: 'SEND_EMAIL_HOOK_SECRET não configurado',
      statusCode: 500,
    });
  }
  return raw.replace(/^v1,whsec_/, '');
}

export async function handleAuthSendEmailHook(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const payloadText = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(getHookSecret());

  let hookPayload: AuthSendEmailHookPayload;
  try {
    hookPayload = wh.verify(payloadText, headers) as AuthSendEmailHookPayload;
  } catch (err) {
    console.error('[auth-send-email] webhook verification failed', err);
    return new Response(
      JSON.stringify({ error: { message: 'Invalid webhook signature' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { user, email_data: emailData } = hookPayload;
  if (!user?.email || !emailData?.email_action_type) {
    return new Response(
      JSON.stringify({ error: { message: 'Payload inválido' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const email = buildAuthEmailContent(user, emailData);

  try {
    const messageId = await sendSesEmail({
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    console.log(JSON.stringify({
      level: 'info',
      action: 'auth_email_sent',
      type: emailData.email_action_type,
      to: email.to,
      message_id: messageId,
    }));

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[auth-send-email] SES send failed', err);
    return new Response(
      JSON.stringify({ error: { message: err instanceof Error ? err.message : 'Falha ao enviar e-mail' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
