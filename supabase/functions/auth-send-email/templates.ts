import type { AuthSendEmailData, AuthSendEmailUser } from './types.ts';

const BRAND = {
  primary: '#0f766e',
  bg: '#f8faf9',
  text: '#1f2a2e',
  muted: '#4b5a60',
};

function wrapLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:Georgia,'Times New Roman',serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e2e8e6;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.primary};font-family:Arial,sans-serif;">Unithery</td></tr>
        <tr><td style="padding:8px 32px 4px;font-size:22px;font-weight:600;">${title}</td></tr>
        <tr><td style="padding:8px 32px 24px;font-size:15px;line-height:1.6;color:${BRAND.muted};font-family:Arial,sans-serif;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 32px 28px;border-top:1px solid #eef2f1;font-size:12px;color:#7c8a90;font-family:Arial,sans-serif;">
          Este e-mail foi enviado pela plataforma Unithery. Se você não reconhece esta ação, ignore esta mensagem.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:${BRAND.primary};color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">${label}</a></p>`;
}

function getAppOrigin(emailData: AuthSendEmailData): string {
  if (emailData.redirect_to) {
    try {
      return new URL(emailData.redirect_to).origin;
    } catch {
      // segue para site_url
    }
  }

  const site = emailData.site_url?.trim();
  if (site) {
    try {
      return new URL(site).origin;
    } catch {
      return site.replace(/\/$/, '');
    }
  }

  return 'https://www.unithery.com';
}

function normalizeUrlOtpType(actionType: string): string {
  if (actionType === 'signup' || actionType === 'magiclink') return 'email';
  if (actionType === 'email_change_new') return 'email_change';
  return actionType;
}

export function buildConfirmationUrl(
  emailData: AuthSendEmailData,
  tokenHash: string,
  actionType: string,
): string {
  const origin = getAppOrigin(emailData);
  const redirectTo = emailData.redirect_to || origin;
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type: normalizeUrlOtpType(actionType),
    redirect_to: redirectTo,
  });
  return `${origin}/auth/confirm?${params.toString()}`;
}

const SUBJECTS: Record<string, string> = {
  signup: 'Confirme seu e-mail — Unithery',
  recovery: 'Redefinir sua senha — Unithery',
  invite: 'Você foi convidado — Unithery',
  magiclink: 'Seu link de acesso — Unithery',
  email_change: 'Confirme a troca de e-mail — Unithery',
  email_change_new: 'Confirme seu novo e-mail — Unithery',
  reauthentication: 'Código de verificação — Unithery',
};

export function buildAuthEmailContent(
  user: AuthSendEmailUser,
  emailData: AuthSendEmailData,
): { subject: string; html: string; text: string; to: string } {
  const type = emailData.email_action_type;
  const subject = SUBJECTS[type] ?? 'Notificação — Unithery';

  if (type === 'reauthentication') {
    const html = wrapLayout(
      'Código de verificação',
      `<p>Use o código abaixo para confirmar sua identidade. Ele expira em breve.</p>
       <p style="font-size:28px;font-weight:700;letter-spacing:.2em;color:${BRAND.primary};font-family:monospace;">${emailData.token}</p>`,
    );
    return {
      subject,
      html,
      text: `Seu código de verificação Unithery: ${emailData.token}`,
      to: user.email,
    };
  }

  let tokenHash = emailData.token_hash;
  let actionType = type;
  let recipient = user.email;

  if (type === 'email_change') {
    tokenHash = emailData.token_hash_new || emailData.token_hash;
    actionType = 'email_change';
    recipient = user.email;
  } else if (type === 'email_change_new') {
    tokenHash = emailData.token_hash;
    actionType = 'email_change';
    recipient = user.new_email || user.email;
  }

  const confirmationUrl = buildConfirmationUrl(emailData, tokenHash, actionType);
  const displayName = typeof user.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name.trim()
    : '';

  const copy: Record<string, { title: string; lead: string; cta: string }> = {
    signup: {
      title: 'Confirme seu e-mail',
      lead: displayName
        ? `Olá, ${displayName}! Falta só um passo para ativar sua conta na Unithery. Clique no botão abaixo para confirmar seu e-mail.`
        : 'Falta só um passo para ativar sua conta na Unithery. Clique no botão abaixo para confirmar seu e-mail.',
      cta: 'Confirmar e-mail',
    },
    recovery: {
      title: 'Redefinir senha',
      lead: 'Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para escolher uma nova senha.',
      cta: 'Redefinir senha',
    },
    invite: {
      title: 'Você foi convidado',
      lead: 'Você recebeu um convite para acessar a Unithery. Clique abaixo para aceitar.',
      cta: 'Aceitar convite',
    },
    magiclink: {
      title: 'Acesso rápido',
      lead: 'Use o link abaixo para entrar na sua conta. Ele expira em breve e só pode ser usado uma vez.',
      cta: 'Entrar na Unithery',
    },
    email_change: {
      title: 'Confirmar troca de e-mail',
      lead: `Confirme a alteração do e-mail da sua conta${emailData.old_email ? ` (atual: ${emailData.old_email})` : ''}.`,
      cta: 'Confirmar alteração',
    },
    email_change_new: {
      title: 'Confirmar novo e-mail',
      lead: 'Confirme este endereço como o novo e-mail da sua conta Unithery.',
      cta: 'Confirmar novo e-mail',
    },
  };

  const content = copy[type] ?? {
    title: 'Ação necessária',
    lead: 'Clique no link abaixo para continuar.',
    cta: 'Continuar',
  };

  const html = wrapLayout(
    content.title,
    `<p>${content.lead}</p>${button(confirmationUrl, content.cta)}
     <p style="margin-top:8px;font-size:13px;color:${BRAND.muted};">Este link expira em breve. Se você não criou esta conta, ignore este e-mail.</p>`,
  );

  const text = `${content.title}\n\n${content.lead}\n\n${confirmationUrl}\n\n— Unithery`;

  return { subject, html, text, to: recipient };
}
