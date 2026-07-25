import {
  SendEmailCommand,
  SESv2Client,
} from 'npm:@aws-sdk/client-sesv2@3.699.0';

export interface SesEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function getSesClient(): SESv2Client {
  const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
  const region = Deno.env.get('AWS_SES_REGION') ?? 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY são obrigatórios para SES');
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

  const client = getSesClient();
  const command = new SendEmailCommand({
    FromEmailAddress: `${fromName} <${fromEmail}>`,
    Destination: { ToAddresses: [payload.to] },
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
