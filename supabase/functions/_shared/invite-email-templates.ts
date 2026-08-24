/**
 * E-mails de convite para o Portal do Paciente.
 *
 * Existem dois textos porque existem duas situações humanas distintas. Para o cuidador, o
 * assunto é o filho e o tom é de parceria no acompanhamento. Para o adulto que entra em
 * SELF, o assunto é ele mesmo — e escrever "acompanhe o tratamento do paciente" para
 * alguém que É o paciente soa burocrático e distante. Nenhum dos dois usa a palavra
 * "família" para quem entra como SELF.
 */

const BRAND = {
  primary: '#1A86E2',
  bg: '#F8FAF9',
  text: '#0F172A',
  muted: '#475569',
  border: '#E2E8F0',
  soft: '#EBF5FE',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrapLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Georgia,'Times New Roman',serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
        <tr><td style="height:6px;background:${BRAND.primary};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px 8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.primary};font-family:Arial,sans-serif;">Unithery</td></tr>
        <tr><td style="padding:8px 32px 4px;font-size:26px;font-weight:600;line-height:1.25;">${title}</td></tr>
        <tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.7;color:${BRAND.muted};font-family:Arial,sans-serif;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 32px 28px;border-top:1px solid ${BRAND.border};font-size:12px;color:#94A3B8;font-family:Arial,sans-serif;">
          Enviado pela Unithery a pedido do seu terapeuta. Se você não reconhece este convite, ignore este e-mail.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function codeBlock(code: string, expiresLabel: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 20px;background:${BRAND.soft};border-radius:14px;">
      <tr><td style="padding:20px;text-align:center;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.primary};font-family:Arial,sans-serif;">Seu código de acesso</p>
        <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:.28em;color:${BRAND.text};font-family:Arial,sans-serif;">${escapeHtml(code)}</p>
        <p style="margin:10px 0 0;font-size:13px;color:${BRAND.muted};">Válido por ${escapeHtml(expiresLabel)}</p>
      </td></tr>
    </table>`;
}

export interface InviteEmailParams {
  recipientName: string;
  patientName: string;
  professionalName: string;
  code: string;
  portalUrl: string;
  expiresLabel?: string;
}

export function buildCaregiverInviteEmail(
  params: InviteEmailParams,
): { subject: string; html: string; text: string } {
  const recipient = params.recipientName.trim() || 'você';
  const patient = params.patientName.trim();
  const professional = params.professionalName.trim() || 'o terapeuta';
  const expires = params.expiresLabel ?? '7 dias';

  const subject = `${professional} convidou você para acompanhar ${patient} na Unithery`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(recipient)}</strong>.</p>
    <p style="margin:0 0 16px;">
      <strong style="color:${BRAND.text};">${escapeHtml(professional)}</strong> abriu um espaço para você
      acompanhar de perto o cuidado de <strong style="color:${BRAND.text};">${escapeHtml(patient)}</strong>.
    </p>
    <p style="margin:0 0 16px;">
      No portal você registra como foi o dia, o sono e os combinados, e lê os resumos que o terapeuta
      liberar. Nada do que você escreve se perde entre uma sessão e outra — tudo chega organizado
      para quem cuida.
    </p>
    ${codeBlock(params.code, expires)}
    <p style="margin:0 0 16px;">
      <a href="${params.portalUrl}" style="display:inline-block;background:${BRAND.primary};color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;">Ativar meu acesso</a>
    </p>
    <p style="margin:0;font-size:13px;">
      Se preferir, acesse <span style="color:${BRAND.text};">${escapeHtml(params.portalUrl)}</span> e informe o código acima.
    </p>`;

  const text = [
    `Olá, ${recipient}.`,
    '',
    `${professional} abriu um espaço para você acompanhar o cuidado de ${patient} na Unithery.`,
    '',
    `Código de acesso: ${params.code} (válido por ${expires})`,
    `Portal: ${params.portalUrl}`,
    '',
    'Se você não reconhece este convite, ignore este e-mail.',
  ].join('\n');

  return { subject, html: wrapLayout('Você foi convidado a acompanhar de perto', bodyHtml), text };
}

export function buildSelfInviteEmail(
  params: InviteEmailParams,
): { subject: string; html: string; text: string } {
  const recipient = params.recipientName.trim() || params.patientName.trim();
  const professional = params.professionalName.trim() || 'seu terapeuta';
  const expires = params.expiresLabel ?? '7 dias';

  const subject = `${professional} criou seu espaço na Unithery`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(recipient)}</strong>.</p>
    <p style="margin:0 0 16px;">
      <strong style="color:${BRAND.text};">${escapeHtml(professional)}</strong> criou um espaço só seu na Unithery,
      para acompanhar seu processo entre uma sessão e outra.
    </p>
    <p style="margin:0 0 16px;">
      Ali você registra como está se sentindo — por texto ou por áudio, quando fizer sentido para você —
      e lê os resumos que seu terapeuta liberar. O que você escreve fica no seu espaço, e você decide
      o que é compartilhado.
    </p>
    ${codeBlock(params.code, expires)}
    <p style="margin:0 0 16px;">
      <a href="${params.portalUrl}" style="display:inline-block;background:${BRAND.primary};color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;">Entrar no meu espaço</a>
    </p>
    <p style="margin:0;font-size:13px;">
      Se preferir, acesse <span style="color:${BRAND.text};">${escapeHtml(params.portalUrl)}</span> e informe o código acima.
    </p>`;

  const text = [
    `Olá, ${recipient}.`,
    '',
    `${professional} criou um espaço só seu na Unithery, para acompanhar seu processo entre as sessões.`,
    '',
    `Código de acesso: ${params.code} (válido por ${expires})`,
    `Portal: ${params.portalUrl}`,
    '',
    'Se você não reconhece este convite, ignore este e-mail.',
  ].join('\n');

  return { subject, html: wrapLayout('Seu espaço na Unithery está pronto', bodyHtml), text };
}

export function buildPortalInviteEmail(
  accessLevel: 'CAREGIVER' | 'SELF',
  params: InviteEmailParams,
): { subject: string; html: string; text: string } {
  return accessLevel === 'SELF'
    ? buildSelfInviteEmail(params)
    : buildCaregiverInviteEmail(params);
}

/** Converte horas de validade em um rótulo humano, evitando "168 horas". */
export function formatExpiryLabel(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? '1 dia' : `${days} dias`;
  }
  return hours === 1 ? '1 hora' : `${hours} horas`;
}
