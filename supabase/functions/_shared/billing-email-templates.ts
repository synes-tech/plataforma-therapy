export type BillingEmailKind = 'welcome' | 'plan_changed' | 'trial_ending_24h';

const BRAND = {
  primary: '#1A86E2',
  bg: '#F8FAF9',
  text: '#0F172A',
  muted: '#475569',
  border: '#E2E8F0',
  soft: '#EBF5FE',
  mint: '#059669',
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Plano Free',
  standard: 'Plano Standard',
  advanced: 'Plano Advanced',
  premium: 'Plano Premium',
  inicial: 'Plano Standard',
  intermediario: 'Plano Advanced',
  consultorio: 'Plano Standard',
  starter: 'Clínica Starter',
  professional: 'Clínica Pro',
  enterprise: 'Enterprise',
};

export function billingPlanLabel(planId: string | null | undefined): string {
  if (!planId) return 'seu plano Unithery';
  return PLAN_LABELS[planId] ?? planId;
}

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
          Enviado pela Unithery. Se você não reconhece esta assinatura, responda este e-mail.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function buildBillingWelcomeEmail(params: {
  ownerName: string;
  clinicName: string;
  planId: string;
  billingCycle?: 'monthly' | 'yearly' | null;
}): { subject: string; html: string; text: string } {
  const name = params.ownerName.trim() || 'profissional';
  const clinic = params.clinicName.trim() || 'seu consultório';
  const plan = billingPlanLabel(params.planId);
  const cycle = params.billingCycle === 'yearly' ? 'anual' : 'mensal';

  const subject = `Parabéns, ${name} — agora você faz parte do time Unithery`;
  const title = 'Bem-vindo ao time Unithery';

  const bodyHtml = `
    <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(name)}</strong>!</p>
    <p style="margin:0 0 16px;">
      <strong style="color:${BRAND.text};">Parabéns.</strong> A partir de agora,
      <strong style="color:${BRAND.text};">${escapeHtml(clinic)}</strong> faz parte do time Unithery.
      Sua prática ganhou um espaço mais calmo, organizado e inteligente para cuidar de cada paciente.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 20px;background:${BRAND.soft};border-radius:14px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${BRAND.primary};font-family:Arial,sans-serif;">Seu plano</p>
        <p style="margin:0;font-size:18px;font-weight:700;color:${BRAND.text};">${escapeHtml(plan)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:${BRAND.muted};">Ciclo ${cycle}</p>
      </td></tr>
    </table>
    <p style="margin:0 0 16px;">
      Por aqui você agenda sessões, registra o cuidado, conversa com o copiloto e mantém a família perto —
      sem perder o fio de cada história.
    </p>
    <p style="margin:0 0 22px;">
      Se precisar de qualquer coisa, é só responder este e-mail. Estamos com você.
    </p>
    <p style="margin:0;font-size:14px;color:${BRAND.mint};font-weight:600;">Com carinho,<br/>Equipe Unithery</p>
  `;

  const text = [
    'Unithery',
    'Bem-vindo ao time Unithery',
    '',
    `Olá, ${name}!`,
    `Parabéns. A partir de agora, ${clinic} faz parte do time Unithery.`,
    `Plano: ${plan} (${cycle}).`,
    '',
    'Por aqui você agenda sessões, registra o cuidado, conversa com o copiloto e mantém a família perto.',
    'Se precisar de qualquer coisa, responda este e-mail.',
    '',
    'Com carinho,',
    'Equipe Unithery',
  ].join('\n');

  return { subject, html: wrapLayout(title, bodyHtml), text };
}

export function buildBillingPlanChangedEmail(params: {
  ownerName: string;
  clinicName: string;
  previousPlanId: string | null;
  nextPlanId: string;
  billingCycle?: 'monthly' | 'yearly' | null;
}): { subject: string; html: string; text: string } {
  const name = params.ownerName.trim() || 'profissional';
  const clinic = params.clinicName.trim() || 'seu consultório';
  const previous = billingPlanLabel(params.previousPlanId);
  const next = billingPlanLabel(params.nextPlanId);
  const cycle = params.billingCycle === 'yearly' ? 'anual' : 'mensal';

  const subject = `Seu plano Unithery foi atualizado — ${next}`;
  const title = 'Plano atualizado';

  const bodyHtml = `
    <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(name)}</strong>!</p>
    <p style="margin:0 0 16px;">
      A assinatura de <strong style="color:${BRAND.text};">${escapeHtml(clinic)}</strong> foi atualizada com sucesso.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 20px;background:${BRAND.soft};border-radius:14px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 8px;font-size:13px;color:${BRAND.muted};">De <strong style="color:${BRAND.text};">${escapeHtml(previous)}</strong></p>
        <p style="margin:0;font-size:18px;font-weight:700;color:${BRAND.text};">Para ${escapeHtml(next)}</p>
        <p style="margin:6px 0 0;font-size:13px;color:${BRAND.muted};">Ciclo ${cycle}</p>
      </td></tr>
    </table>
    <p style="margin:0 0 22px;">
      As novas condições já valem na sua conta. Qualquer dúvida, responda este e-mail — o time Unithery está junto.
    </p>
    <p style="margin:0;font-size:14px;color:${BRAND.mint};font-weight:600;">Equipe Unithery</p>
  `;

  const text = [
    'Unithery',
    'Plano atualizado',
    '',
    `Olá, ${name}!`,
    `A assinatura de ${clinic} foi atualizada.`,
    `De ${previous} para ${next} (${cycle}).`,
    '',
    'Equipe Unithery',
  ].join('\n');

  return { subject, html: wrapLayout(title, bodyHtml), text };
}

export function formatTrialChargeDate(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return 'em breve';
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
}

export function buildBillingTrialEnding24hEmail(params: {
  ownerName: string;
  clinicName: string;
  planId: string;
  trialEndsAt: string;
  settingsUrl: string;
}): { subject: string; html: string; text: string } {
  const name = params.ownerName.trim() || 'profissional';
  const clinic = params.clinicName.trim() || 'seu consultório';
  const plan = billingPlanLabel(params.planId);
  const chargeDate = formatTrialChargeDate(params.trialEndsAt);
  const settingsUrl = params.settingsUrl.replace(/\/$/, '');

  const subject = `Faltam 24 horas para o fim do seu período grátis na Unithery`;
  const title = 'Seu período grátis termina amanhã';

  const bodyHtml = `
    <p style="margin:0 0 16px;">Olá, <strong style="color:${BRAND.text};">${escapeHtml(name)}</strong>!</p>
    <p style="margin:0 0 16px;">
      O período de teste de 14 dias de <strong style="color:${BRAND.text};">${escapeHtml(clinic)}</strong>
      no <strong style="color:${BRAND.text};">${escapeHtml(plan)}</strong> termina em
      <strong style="color:${BRAND.text};">${escapeHtml(chargeDate)}</strong>.
    </p>
    <p style="margin:0 0 16px;">
      <strong style="color:${BRAND.text};">Se quiser continuar, não precisa fazer nada.</strong>
      No dia ${escapeHtml(chargeDate)} a cobrança será feita automaticamente no cartão cadastrado.
    </p>
    <p style="margin:0 0 12px;">
      Se não quiser ser cobrado, cancele a assinatura <strong style="color:${BRAND.text};">antes desse dia</strong>:
    </p>
    <ol style="margin:0 0 20px;padding-left:20px;">
      <li style="margin:0 0 8px;">Entre na Unithery</li>
      <li style="margin:0 0 8px;">Abra <strong style="color:${BRAND.text};">Configurações</strong></li>
      <li style="margin:0 0 8px;">Na seção <strong style="color:${BRAND.text};">Plano</strong>, clique em
        <em>Cancelar plano e revogar método de pagamento</em></li>
    </ol>
    <p style="margin:0 0 22px;">
      <a href="${escapeHtml(settingsUrl)}" style="display:inline-block;background:${BRAND.primary};color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">
        Abrir Configurações → Plano
      </a>
    </p>
    <p style="margin:0;font-size:14px;color:${BRAND.mint};font-weight:600;">Equipe Unithery</p>
  `;

  const text = [
    'Unithery',
    'Seu período grátis termina amanhã',
    '',
    `Olá, ${name}!`,
    `O período de teste de 14 dias de ${clinic} no ${plan} termina em ${chargeDate}.`,
    '',
    'Se quiser continuar, não precisa fazer nada. A cobrança será feita automaticamente no cartão cadastrado.',
    '',
    'Se não quiser ser cobrado, cancele antes desse dia:',
    '1. Entre na Unithery',
    '2. Abra Configurações',
    '3. Na seção Plano, clique em Cancelar plano e revogar método de pagamento',
    '',
    `Link: ${settingsUrl}`,
    '',
    'Equipe Unithery',
  ].join('\n');

  return { subject, html: wrapLayout(title, bodyHtml), text };
}
