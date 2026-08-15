import { sendSesEmail } from '../_shared/aws-ses.ts';
import type { ContactFormInput } from './schema.ts';
import type { ContactFormResult } from './types.ts';

const SUBJECT_LABELS: Record<ContactFormInput['subject'], string> = {
  duvida_plataforma: 'Dúvida sobre a plataforma',
  problema_tecnico: 'Problema técnico / erro',
  cobranca: 'Cobrança e assinatura',
  cadastro_acesso: 'Cadastro e acesso',
  privacidade: 'Privacidade e dados (LGPD)',
  comercial: 'Parceria / comercial',
  outro: 'Outro',
};

const DEFAULT_INBOX = [
  'contato@unithery.com',
  'contact@unithery.com',
  'synestech.business@gmail.com',
];

function inboxAddresses(): string[] {
  const raw = Deno.env.get('CONTACT_INBOX_EMAILS') ?? '';
  const parsed = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.includes('@'));
  return parsed.length > 0 ? parsed : DEFAULT_INBOX;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildEmail(input: ContactFormInput): { subject: string; html: string; text: string } {
  const subjectLabel = SUBJECT_LABELS[input.subject];
  const safeName = escapeHtml(input.name);
  const safeEmail = escapeHtml(input.email);
  const safeSubject = escapeHtml(subjectLabel);
  const safeMessage = escapeHtml(input.message).replaceAll('\n', '<br />');

  return {
    subject: `[Fale conosco] ${subjectLabel} — ${input.name}`,
    text: [
      'Novo chamado — Fale conosco',
      '',
      `Nome: ${input.name}`,
      `E-mail: ${input.email}`,
      `Assunto: ${subjectLabel}`,
      '',
      input.message,
    ].join('\n'),
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#F8FAF9;font-family:Inter,Arial,sans-serif;color:#0F172A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E2E8F0;border-radius:16px;">
    <tr>
      <td style="padding:24px 28px 8px;">
        <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;">Fale conosco</p>
        <h1 style="margin:8px 0 0;font-size:20px;font-weight:600;">Novo chamado</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 28px 24px;">
        <p style="margin:0 0 8px;"><strong>Nome:</strong> ${safeName}</p>
        <p style="margin:0 0 8px;"><strong>E-mail:</strong> ${safeEmail}</p>
        <p style="margin:0 0 16px;"><strong>Assunto:</strong> ${safeSubject}</p>
        <div style="padding:16px;background:#F8FAF9;border-radius:12px;line-height:1.55;white-space:normal;">
          ${safeMessage}
        </div>
        <p style="margin:16px 0 0;font-size:12px;color:#64748B;">Responda este e-mail para falar direto com a pessoa.</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };
}

export async function submitContactForm(
  input: ContactFormInput,
): Promise<ContactFormResult> {
  if (input.website.trim()) {
    return { sent: true };
  }

  const content = buildEmail(input);
  await sendSesEmail({
    to: inboxAddresses(),
    replyTo: input.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  return { sent: true };
}
