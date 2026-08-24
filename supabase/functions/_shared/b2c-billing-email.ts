import { sendSesEmail } from './aws-ses.ts';
import { createServiceClient } from './supabase.ts';
import {
  formatBrDate,
  formatBrlCents,
  THERY_AMOUNT_CENTS,
  THERY_PLAN_NAME,
} from './b2c-billing.utils.ts';

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
        <tr><td style="padding:28px 32px 8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.primary};font-family:Arial,sans-serif;">Unithery · Ivy</td></tr>
        <tr><td style="padding:8px 32px 4px;font-size:26px;font-weight:600;line-height:1.25;">${title}</td></tr>
        <tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.7;color:${BRAND.muted};font-family:Arial,sans-serif;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 32px 28px;border-top:1px solid ${BRAND.border};font-size:12px;color:#94A3B8;font-family:Arial,sans-serif;">
          Você pode cancelar a qualquer momento em Plano de cuidados, antes da cobrança.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function loadPatientMailTarget(userId: string | null | undefined): Promise<{
  to: string;
  name: string;
} | null> {
  if (!userId) return null;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('family_members')
    .select('email, name')
    .eq('user_id', userId)
    .maybeSingle();

  const to = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null;
  return { to, name: (data?.name as string) || 'olá' };
}

export async function notifyPatientTheryWelcome(params: {
  userId: string | null;
  firstName?: string;
  trialEnd: string | null;
}): Promise<boolean> {
  const target = await loadPatientMailTarget(params.userId);
  if (!target) return false;

  const name = params.firstName?.trim() || target.name;
  const trial = formatBrDate(params.trialEnd) || 'em 7 dias';
  const price = formatBrlCents(THERY_AMOUNT_CENTS);
  const subject = `${name}, a Ivy já está com você`;
  const title = 'Seus 7 dias com a Ivy começaram';
  const bodyHtml = `
    <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(name)}</strong>.</p>
    <p style="margin:0 0 16px;">
      O <strong style="color:${BRAND.text};">${escapeHtml(THERY_PLAN_NAME)}</strong> está liberado.
      Você tem 7 dias para conversar com a Ivy — o cartão já está cadastrado, e a primeira
      cobrança de <strong style="color:${BRAND.text};">${price}</strong> acontece em
      <strong style="color:${BRAND.text};">${trial}</strong>, se você não cancelar antes.
    </p>
    <p style="margin:0;">A Ivy é uma Acompanhante de Apoio. Ela não substitui o seu psicólogo.</p>
  `;
  const text = [
    `${name}, a Ivy já está com você.`,
    `7 dias grátis. Cobrança de ${price} em ${trial} se você não cancelar.`,
    'Cancele em Plano de cuidados a qualquer momento.',
  ].join('\n');

  await sendSesEmail({ to: target.to, subject, html: wrapLayout(title, bodyHtml), text });
  return true;
}

export async function notifyPatientTrialEnding(params: {
  userId: string | null;
  firstName?: string;
  trialEnd: string | null;
  daysBefore: 1 | 3;
}): Promise<boolean> {
  const target = await loadPatientMailTarget(params.userId);
  if (!target) return false;

  const name = params.firstName?.trim() || target.name;
  const trial = formatBrDate(params.trialEnd) || 'em breve';
  const price = formatBrlCents(THERY_AMOUNT_CENTS);
  const when = params.daysBefore === 1 ? 'amanhã' : 'em 3 dias';
  const subject = `${name}, o período grátis da Ivy termina ${when}`;
  const title = 'A cobrança da Ivy está próxima';
  const bodyHtml = `
    <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(name)}</strong>.</p>
    <p style="margin:0 0 16px;">
      Seu período gratuito termina em <strong style="color:${BRAND.text};">${trial}</strong>.
      A partir dessa data, cobramos <strong style="color:${BRAND.text};">${price}</strong>/mês
      no cartão cadastrado.
    </p>
    <p style="margin:0;">
      Se não quiser continuar, cancele em <em>Plano de cuidados</em> antes dessa data —
      nenhuma cobrança é feita.
    </p>
  `;
  const text = [
    `O período gratuito da Ivy termina ${when} (${trial}).`,
    `Cobrança de ${price}/mês no cartão cadastrado.`,
    'Cancele em Plano de cuidados para não ser cobrado.',
  ].join('\n');

  await sendSesEmail({ to: target.to, subject, html: wrapLayout(title, bodyHtml), text });
  return true;
}
