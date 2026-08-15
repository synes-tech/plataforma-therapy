import {
  SendEmailCommand,
  SESv2Client,
} from 'npm:@aws-sdk/client-sesv2@3.699.0';
import { AppError } from './errors.ts';

export interface SesEmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

function getSesClient(): SESv2Client {
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  const region = Deno.env.get('AWS_SES_REGION') ?? 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    throw new AppError({
      code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      message:
        'Envio de e-mail não configurado neste ambiente (faltam AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY no Cloud Run).',
      statusCode: 503,
    });
  }

  return new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function sendSesEmail(payload: SesEmailPayload): Promise<string> {
  const fromEmail = Deno.env.get('AWS_SES_FROM_EMAIL') ?? 'contact@unithery.com';
  const fromName = Deno.env.get('AWS_SES_FROM_NAME') ?? 'Unithery';
  const configurationSet = Deno.env.get('AWS_SES_CONFIGURATION_SET');

  const toAddresses = (Array.isArray(payload.to) ? payload.to : [payload.to])
    .map((addr) => addr.trim())
    .filter(Boolean);

  const client = getSesClient();
  const command = new SendEmailCommand({
    FromEmailAddress: `${fromName} <${fromEmail}>`,
    Destination: { ToAddresses: toAddresses },
    ...(payload.replyTo ? { ReplyToAddresses: [payload.replyTo] } : {}),
    Content: {
      Simple: {
        Subject: { Data: payload.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: payload.html, Charset: 'UTF-8' },
          Text: { Data: payload.text, Charset: 'UTF-8' },
        },
      },
    },
    ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
  });

  const result = await client.send(command);
  return result.MessageId ?? '';
}
