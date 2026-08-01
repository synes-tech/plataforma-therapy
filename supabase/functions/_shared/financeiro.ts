import { createServiceClient } from './supabase.ts';
import { AppError, ForbiddenError } from './errors.ts';
import type { AuthenticatedUser } from './auth.ts';
export type FinanceModelo = 'avulso' | 'pacote' | 'social';
export type FinanceTipo = 'ENTRADA' | 'SAIDA';
export type FinanceStatus = 'PAGO' | 'PENDENTE' | 'ATRASADO' | 'CANCELADO';
export type FinanceCategoria =
  | 'SESSAO_AVULSA'
  | 'PACOTE'
  | 'SESSAO_SOCIAL'
  | 'RENDIMENTO_EXTRA'
  | 'CUSTO_FIXO'
  | 'CUSTO_VARIAVEL'
  | 'IMPOSTO'
  | 'REPASSE_PROFISSIONAL'
  | 'OUTROS';

export function assertFinanceAccess(user: AuthenticatedUser): string {
  const isOwner =
    user.role === 'master' ||
    user.role === 'clinic_admin' ||
    (user.role === 'professional' && user.is_solo);
  if (!isOwner) {
    throw new AppError({
      code: 'FINANCE_FORBIDDEN',
      message: 'Acesso ao caixa restrito a administradores / autônomos.',
      statusCode: 403,
    });
  }
  if (!user.clinic_id && user.role !== 'master') {
    throw new ForbiddenError('Clínica não identificada');
  }
  if (!user.clinic_id) {
    throw new AppError({
      code: 'CLINIC_REQUIRED',
      message: 'clinic_id é obrigatório',
      statusCode: 400,
    });
  }
  return user.clinic_id;
}

export async function resolveProfessionalId(
  user: AuthenticatedUser,
  clinicId: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export function monthRange(yearMonth: string): { start: string; end: string; startIso: string; endIso: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) {
    throw new AppError({ code: 'VALIDATION_ERROR', message: 'month inválido (YYYY-MM)', statusCode: 400 });
  }
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return {
    start,
    end,
    startIso: `${start}T00:00:00.000Z`,
    endIso: `${end}T23:59:59.999Z`,
  };
}

export async function getPatientPlan(patientId: string, clinicId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('financeiro_planos_paciente')
    .select('*')
    .eq('patient_id', patientId)
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .maybeSingle();
  return data;
}

export async function getPatientBalance(patientId: string, clinicId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('financeiro_saldos_pacientes')
    .select('sessoes_disponiveis')
    .eq('paciente_id', patientId)
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .maybeSingle();
  return Number(data?.sessoes_disponiveis ?? 0);
}

export async function ensureSessionBillingRow(params: {
  clinicId: string;
  scheduleId: string;
  patientId: string;
  professionalId: string | null;
  valorPrevistoCents: number;
  status?: string;
}) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('financeiro_sessoes_cobranca')
    .upsert(
      {
        clinic_id: params.clinicId,
        schedule_id: params.scheduleId,
        patient_id: params.patientId,
        professional_id: params.professionalId,
        valor_previsto_cents: params.valorPrevistoCents,
        status_cobranca: params.status ?? 'PENDENTE_CONFIRMACAO',
        deleted_at: null,
      },
      { onConflict: 'schedule_id' },
    )
    .select('*')
    .single();

  if (error) {
    throw new AppError({
      code: 'BILLING_UPSERT_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }
  return data;
}

export async function buildPaymentPrompt(params: {
  clinicId: string;
  scheduleId: string;
  patientId: string;
  patientName: string;
  professionalId: string | null;
}) {
  const plan = await getPatientPlan(params.patientId, params.clinicId);
  const saldo = await getPatientBalance(params.patientId, params.clinicId);
  const valorPrevisto =
    plan?.modelo === 'pacote' && plan.pacote_qtd_sessoes && plan.pacote_valor_cents
      ? Math.round(Number(plan.pacote_valor_cents) / Number(plan.pacote_qtd_sessoes))
      : Number(plan?.valor_sessao_cents ?? 0);

  await ensureSessionBillingRow({
    clinicId: params.clinicId,
    scheduleId: params.scheduleId,
    patientId: params.patientId,
    professionalId: params.professionalId,
    valorPrevistoCents: valorPrevisto,
    status: 'PENDENTE_CONFIRMACAO',
  });

  return {
    schedule_id: params.scheduleId,
    patient_id: params.patientId,
    patient_name: params.patientName,
    modelo: (plan?.modelo as FinanceModelo | undefined) ?? 'avulso',
    saldo_sessoes: saldo,
    valor_sugerido_cents: valorPrevisto,
    pode_consumir_pacote: saldo > 0,
  };
}
