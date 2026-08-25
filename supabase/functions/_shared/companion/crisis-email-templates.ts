import type { CrisisEmailKind } from './alerts.ts';

export type { CrisisEmailKind };

const BRAND = {
  primary: '#1A86E2',
  urgent: '#B42318',
  bg: '#F8FAF9',
  text: '#0F172A',
  muted: '#475569',
  border: '#E2E8F0',
  soft: '#FEF3F2',
};

export function clipReportedText(text: string, max = 800): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrapLayout(title: string, bodyHtml: string, urgent: boolean): string {
  const bar = urgent ? BRAND.urgent : BRAND.primary;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Georgia,'Times New Roman',serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
        <tr><td style="height:6px;background:${bar};font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px 8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${bar};font-family:Arial,sans-serif;">Unithery · alerta clínico</td></tr>
        <tr><td style="padding:8px 32px 4px;font-size:26px;font-weight:600;line-height:1.25;">${title}</td></tr>
        <tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.7;color:${BRAND.muted};font-family:Arial,sans-serif;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 32px 28px;border-top:1px solid ${BRAND.border};font-size:12px;color:#94A3B8;font-family:Arial,sans-serif;">
          Enviado automaticamente pela Unithery. Este e-mail contém um relato do paciente ou da família.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export interface CrisisAlertEmailInput {
  professionalName: string;
  patientName: string;
  kind: CrisisEmailKind;
  reportedText: string;
  recordUrl: string;
  crisisLevel?: number | null;
}

export function buildCrisisAlertEmail(input: CrisisAlertEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const pro = input.professionalName.trim() || 'profissional';
  const patient = input.patientName.trim() || 'seu paciente';
  const quote = clipReportedText(input.reportedText) || 'O relato não veio com texto adicional.';
  const urgent = input.kind === 'companion_severe' || input.kind === 'checkin_crisis';
  const level =
    input.kind === 'checkin_crisis' && input.crisisLevel
      ? ` Nível ${input.crisisLevel}/5.`
      : '';

  const headline =
    input.kind === 'companion_severe'
      ? `${patient} sinalizou risco de vida na Ivy`
      : input.kind === 'companion_moderate'
        ? `${patient} relatou sofrimento intenso na Ivy`
        : `${patient} registrou uma crise no check-in`;

  const origin =
    input.kind === 'checkin_crisis'
      ? `foi marcada uma crise no check-in.${level}`
      : input.kind === 'companion_severe'
        ? 'a Ivy identificou um alerta severo no chat (risco de vida). O protocolo de emergência (188 / 192) foi exibido.'
        : 'a Ivy identificou sofrimento intenso no chat. Não há sinal de risco de vida neste alerta.';

  const subject =
    input.kind === 'companion_severe'
      ? `[Urgente] ${patient} sinalizou risco de vida na Ivy`
      : input.kind === 'checkin_crisis'
        ? `[Crise] ${patient} registrou uma crise no check-in`
        : `[Atenção] ${patient} relatou sofrimento intenso na Ivy`;

  const title = urgent ? 'Alerta urgente' : 'Alerta clínico';

  const bodyHtml = `
    <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(pro)}</strong>.</p>
    <p style="margin:0 0 16px;">
      Sobre <strong style="color:${BRAND.text};">${escapeHtml(patient)}</strong>, ${origin}
    </p>
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.urgent};font-family:Arial,sans-serif;">O que foi relatado</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;background:${BRAND.soft};border-radius:14px;">
      <tr><td style="padding:16px 18px;font-size:15px;line-height:1.6;color:${BRAND.text};">
        ${escapeHtml(quote)}
      </td></tr>
    </table>
    <p style="margin:0 0 20px;">Abra o prontuário para acompanhar o alerta e decidir o próximo contato.</p>
    <p style="margin:0;">
      <a href="${escapeHtml(input.recordUrl)}"
         style="display:inline-block;background:${urgent ? BRAND.urgent : BRAND.primary};color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">
        Abrir prontuário
      </a>
    </p>
  `;

  const text = [
    `Olá, ${pro}.`,
    '',
    headline,
    origin,
    '',
    'O que foi relatado:',
    quote,
    '',
    `Prontuário: ${input.recordUrl}`,
  ].join('\n');

  return {
    subject,
    html: wrapLayout(title, bodyHtml, urgent),
    text,
  };
}
