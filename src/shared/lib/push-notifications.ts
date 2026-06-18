import { callFunction } from './api';

const DISMISS_KEY = 'unithery_push_prompt_dismissed';
const SUBSCRIBED_KEY = 'unithery_push_subscribed';

export type PushPermissionState = NotificationPermission | 'unsupported';

export function getPushSupport(): PushPermissionState {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function wasPushPromptDismissed(): boolean {
  return localStorage.getItem(DISMISS_KEY) === '1';
}

export function dismissPushPrompt(): void {
  localStorage.setItem(DISMISS_KEY, '1');
}

export function wasPushSubscribed(): boolean {
  return localStorage.getItem(SUBSCRIBED_KEY) === '1';
}

function markPushSubscribed(): void {
  localStorage.setItem(SUBSCRIBED_KEY, '1');
  localStorage.removeItem(DISMISS_KEY);
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function subscribeToPushNotifications(): Promise<'granted' | 'denied' | 'unsupported'> {
  const support = getPushSupport();
  if (support === 'unsupported') return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) {
    throw new Error('VAPID_PUBLIC_KEY não configurada no frontend');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const keyBytes = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes as BufferSource,
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Subscription inválida');
  }

  await callFunction('register-push-subscription', {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    user_agent: navigator.userAgent.slice(0, 500),
  });

  markPushSubscribed();
  return 'granted';
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
  localStorage.removeItem(SUBSCRIBED_KEY);
}
