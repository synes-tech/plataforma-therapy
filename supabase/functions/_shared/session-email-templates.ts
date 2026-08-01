export type SessionEmailKind = 'booking_confirmation' | 'reminder_24h' | 'reminder_manual';

/** Mesma identidade visual dos e-mails de auth (recuperação de senha, etc.). */
const BRAND = {
  primary: '#0f766e',
  bg: '#f8faf9',
  text: '#1f2a2e',
  muted: '#4b5a60',
  border: '#e2e8e6',
  soft: '#eef2f1',
  cardBg: '#f0fafa',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatParts(iso: string): { dateLabel: string; timeLabel: string; fullLabel: string } {
  const date = new Date(iso);
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);

  const timeLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  return {
    dateLabel,
    timeLabel,
    fullLabel: `${dateLabel} às ${timeLabel}`,
  };
}

export function formatSessionDateTimeBr(iso: string): string {
  return formatParts(iso).fullLabel;
}

function wrapLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Georgia,'Times New Roman',serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.primary};font-family:Arial,sans-serif;">Unithery</td></tr>
        <tr><td style="padding:8px 32px 4px;font-size:22px;font-weight:600;">${title}</td></tr>
        <tr><td style="padding:8px 32px 24px;font-size:15px;line-height:1.6;color:${BRAND.muted};font-family:Arial,sans-serif;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 32px 28px;border-top:1px solid ${BRAND.soft};font-size:12px;color:#7c8a90;font-family:Arial,sans-serif;">
          Este e-mail foi enviado pela plataforma Unithery em nome do consultório/clínica. Se você não reconhece este atendimento, entre em contato com o profissional responsável.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${BRAND.primary};font-family:Arial,sans-serif;width:34%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-size:14px;color:${BRAND.text};font-family:Arial,sans-serif;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;
}

function sessionDetailsCard(params: {
  patientName: string;
  professionalName: string;
  dateLabel: string;
  timeLabel: string;
  durationMinutes: number | null;
}): string {
  const duration = params.durationMinutes
    ? `${params.durationMinutes} minutos`
    : 'A combinar com o consultório';

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:${BRAND.cardBg};border:1px solid #d5ebe8;border-radius:14px;">
    <tr><td style="padding:18px 20px;">
      <p style="margin:0 0 12px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.primary};font-family:Arial,sans-serif;">Detalhes do atendimento</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        ${detailRow('Paciente', params.patientName)}
        ${detailRow('Profissional', params.professionalName)}
        ${detailRow('Data', params.dateLabel)}
        ${detailRow('Horário', params.timeLabel)}
        ${detailRow('Duração', duration)}
      </table>
    </td></tr>
  </table>`;
}

const COPY: Record<
  SessionEmailKind,
  { subject: (patientName: string) => string; title: string; lead: (p: {
    contactName: string;
    patientName: string;
    professionalName: string;
  }) => string }
> = {
  booking_confirmation: {
    subject: (patientName) => `Sessão agendada — ${patientName} | Unithery`,
    title: 'Sessão terapêutica agendada',
    lead: ({ contactName, patientName, professionalName }) =>
      `Olá, <strong style="color:${BRAND.text};">${escapeHtml(contactName)}</strong>!<br/><br/>
       Uma sessão terapêutica foi agendada para <strong style="color:${BRAND.text};">${escapeHtml(patientName)}</strong>
       com o(a) psicólogo(a) <strong style="color:${BRAND.text};">${escapeHtml(professionalName)}</strong>.
       Confira abaixo os detalhes do atendimento.`,
  },
  reminder_24h: {
    subject: (patientName) => `Lembrete: atendimento em 24h — ${patientName} | Unithery`,
    title: 'Lembrete de atendimento',
    lead: ({ contactName, patientName, professionalName }) =>
      `Olá, <strong style="color:${BRAND.text};">${escapeHtml(contactName)}</strong>!<br/><br/>
       Este é um lembrete da Unithery: o atendimento de
       <strong style="color:${BRAND.text};">${escapeHtml(patientName)}</strong> com
       <strong style="color:${BRAND.text};">${escapeHtml(professionalName)}</strong>
       acontece nas próximas 24 horas.`,
  },
  reminder_manual: {
    subject: (patientName) => `Lembrete de atendimento — ${patientName} | Unithery`,
    title: 'Lembrete de atendimento',
    lead: ({ contactName, patientName, professionalName }) =>
      `Olá, <strong style="color:${BRAND.text};">${escapeHtml(contactName)}</strong>!<br/><br/>
       <strong style="color:${BRAND.text};">${escapeHtml(professionalName)}</strong> está enviando um lembrete
       sobre o atendimento de <strong style="color:${BRAND.text};">${escapeHtml(patientName)}</strong>.
       Veja data, horário e duração abaixo.`,
  },
};

export function buildSessionEmailContent(params: {
  kind: SessionEmailKind;
  contactName: string;
  patientName: string;
  professionalName: string;
  sessionAtIso: string;
  durationMinutes: number | null;
}): { subject: string; html: string; text: string } {
  const { dateLabel, timeLabel, fullLabel } = formatParts(params.sessionAtIso);
  const copy = COPY[params.kind];
  const durationText = params.durationMinutes
    ? `${params.durationMinutes} minutos`
    : 'A combinar com o consultório';

  const bodyHtml = `
    <p style="margin:0 0 4px;">${copy.lead({
      contactName: params.contactName,
      patientName: params.patientName,
      professionalName: params.professionalName,
    })}</p>
    ${sessionDetailsCard({
      patientName: params.patientName,
      professionalName: params.professionalName,
      dateLabel,
      timeLabel,
      durationMinutes: params.durationMinutes,
    })}
    <p style="margin:0;font-size:13px;color:${BRAND.muted};">
      Enviado pela <strong style="color:${BRAND.primary};">Unithery</strong> em nome do consultório.
    </p>
  `;

  const html = wrapLayout(copy.title, bodyHtml);

  const text = [
    'Unithery',
    copy.title,
    '',
    `Olá, ${params.contactName}!`,
    `Paciente: ${params.patientName}`,
    `Profissional: ${params.professionalName}`,
    `Data e horário: ${fullLabel}`,
    `Duração prevista: ${durationText}`,
    '',
    'Este e-mail foi enviado pela plataforma Unithery em nome do consultório/clínica.',
  ].join('\n');

  return {
    subject: copy.subject(params.patientName),
    html,
    text,
  };
}
