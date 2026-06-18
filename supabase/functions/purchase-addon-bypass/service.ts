import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { PurchaseAddonBypassPayload, PurchaseAddonBypassResponse } from './types.ts';

const BYPASS_DELAY_MS = 1500;

export async function purchaseAddonBypass(
  payload: PurchaseAddonBypassPayload,
  caller: AuthenticatedUser,
): Promise<PurchaseAddonBypassResponse> {
  if (!caller.clinic_id) {
    throw new ForbiddenError('Usuário sem clínica associada');
  }

  const clinicId = caller.clinic_id;
  const amount = payload.quantidade_comprada;
  const supabase = createServiceClient();

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('id, subscription_status, payment_method_on_file')
    .eq('id', clinicId)
    .is('deleted_at', null)
    .single();

  if (clinicError || !clinic) {
    throw new AppError({
      code: 'CLINIC_NOT_FOUND',
      message: 'Clínica não encontrada',
      statusCode: 404,
    });
  }

  const hasActiveBilling =
    clinic.payment_method_on_file === true ||
    ['trial_active', 'active', 'trialing'].includes(clinic.subscription_status as string);

  if (!hasActiveBilling) {
    throw new AppError({
      code: 'BILLING_REQUIRED',
      message: 'Ative seu plano principal antes de contratar extensões de backup.',
      statusCode: 403,
    });
  }

  await new Promise((resolve) => setTimeout(resolve, BYPASS_DELAY_MS));

  const { data: rpcResult, error: rpcError } = await supabase.rpc('increment_backup_licenses', {
    p_clinic_id: clinicId,
    p_amount: amount,
  });

  if (rpcError) {
    const code = rpcError.message.includes('invalid_amount')
      ? 'INVALID_AMOUNT'
      : 'ADDON_PURCHASE_FAILED';
    throw new AppError({
      code,
      message: rpcError.message,
      statusCode: 400,
    });
  }

  const parsed = rpcResult as { quantidade_backup_pacientes?: number; increment?: number } | null;
  const newTotal = Number(parsed?.quantidade_backup_pacientes ?? 0);

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: clinicId,
    action: 'billing.backup_addon.purchase_bypass',
    resource_type: 'clinic',
    resource_id: clinicId,
    metadata: {
      quantidade_comprada: amount,
      quantidade_backup_pacientes: newTotal,
      bypass: true,
    },
  });

  return {
    clinic_id: clinicId,
    quantidade_comprada: amount,
    quantidade_backup_pacientes: newTotal,
    message: `${amount} licenças de backup adicionadas com sucesso.`,
  };
}
