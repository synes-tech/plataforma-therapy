import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { RegisterPushPayload, RegisterPushResponse } from './types.ts';

export async function registerPushSubscription(
  payload: RegisterPushPayload,
  caller: AuthenticatedUser,
): Promise<RegisterPushResponse> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: caller.id,
        endpoint: payload.endpoint,
        p256dh: payload.keys.p256dh,
        auth_key: payload.keys.auth,
        user_agent: payload.user_agent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' },
    )
    .select('id')
    .single();

  if (error || !data) {
    throw new AppError({
      code: 'PUSH_REGISTER_FAILED',
      message: error?.message ?? 'Falha ao registrar dispositivo',
      statusCode: 500,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: caller.clinic_id,
    action: 'push.subscription_registered',
    resource_type: 'push_subscription',
    resource_id: data.id,
    metadata: { endpoint_prefix: payload.endpoint.slice(0, 60) },
  });

  return {
    subscription_id: data.id,
    message: 'Notificações ativadas neste dispositivo',
  };
}
