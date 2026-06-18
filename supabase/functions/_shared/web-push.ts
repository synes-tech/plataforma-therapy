import webpush from 'npm:web-push@3.6.7';

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let vapidConfigured = false;

function ensureVapid(): void {
  if (vapidConfigured) return;

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@unithery.com';

  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY são obrigatórios para Web Push');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  payload: PushPayload,
): Promise<void> {
  ensureVapid();

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/family/diary',
    tag: payload.tag,
  });

  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth_key,
      },
    },
    body,
    { TTL: 60 * 60 * 24 },
  );
}

/** Retorna true se o endpoint expirou (410 Gone) e deve ser removido */
export function isExpiredPushEndpoint(error: unknown): boolean {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    return (error as { statusCode: number }).statusCode === 410;
  }
  return false;
}
