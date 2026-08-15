import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { createServiceClient } from './supabase.ts';
import { AppError } from './errors.ts';

export type FinanceModelType = 'PARTICULAR' | 'CONVENIO';
export type FinanceBillingType = 'AVULSO' | 'MENSAL_RECORRENTE' | 'PACOTE';
export type FinanceLegacyModelo = 'avulso' | 'pacote' | 'social';

export const FinancialContractInputSchema = z.object({
  patient_id: z.string().uuid(),
  model_type: z.enum(['PARTICULAR', 'CONVENIO']),
  billing_type: z.enum(['AVULSO', 'MENSAL_RECORRENTE', 'PACOTE']),
  valor_acordado_cents: z.number().int().min(0),
  due_day: z.number().int().min(1).max(28).optional().nullable(),
  sessions_per_month: z.number().int().positive().optional().nullable(),
  sessions_custom: z.boolean().optional().default(false),
  contract_duration_months: z.number().int().positive().optional().nullable(),
  contract_starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  observacoes: z.string().max(2000).optional().nullable(),
  pacote_qtd_sessoes: z.number().int().positive().optional().nullable(),
  pacote_valor_cents: z.number().int().min(0).optional().nullable(),
  registrar_pacote_pago: z.boolean().optional().default(false),
});

export type FinancialContractInput = z.infer<typeof FinancialContractInputSchema>;

export const CreatePatientFinanceSchema = z.object({
  financeiro_model_type: z.enum(['PARTICULAR', 'CONVENIO']).optional(),
  financeiro_billing_type: z.enum(['AVULSO', 'MENSAL_RECORRENTE', 'PACOTE']).optional(),
  financeiro_valor_acordado_cents: z.number().int().min(0).optional(),
  financeiro_due_day: z.number().int().min(1).max(28).optional().nullable(),
  financeiro_sessions_per_month: z.number().int().positive().optional().nullable(),
  financeiro_sessions_custom: z.boolean().optional(),
  financeiro_contract_duration_months: z.number().int().positive().optional().nullable(),
  financeiro_contract_starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  financeiro_modelo: z.enum(['avulso', 'pacote', 'social']).optional(),
  financeiro_valor_sessao_cents: z.number().int().min(0).optional(),
  financeiro_pacote_qtd_sessoes: z.number().int().positive().optional().nullable(),
  financeiro_pacote_valor_cents: z.number().int().min(0).optional().nullable(),
  financeiro_registrar_pacote_pago: z.boolean().optional().default(false),
  financeiro_observacoes: z.string().max(2000).optional().nullable(),
});

export function legacyModeloFromContract(input: Pick<FinancialContractInput, 'billing_type' | 'valor_acordado_cents'>): FinanceLegacyModelo {
  if (input.billing_type === 'PACOTE') return 'pacote';
  if (input.valor_acordado_cents === 0) return 'social';
  return 'avulso';
}

export function contractFromCreatePayload(payload: Record<string, unknown>): FinancialContractInput {
  const parsed = CreatePatientFinanceSchema.parse(payload);
  if (parsed.financeiro_model_type && parsed.financeiro_billing_type && parsed.financeiro_valor_acordado_cents != null) {
    return FinancialContractInputSchema.parse({
      patient_id: '00000000-0000-0000-0000-000000000000',
      model_type: parsed.financeiro_model_type,
      billing_type: parsed.financeiro_billing_type,
      valor_acordado_cents: parsed.financeiro_valor_acordado_cents,
      due_day: parsed.financeiro_due_day ?? null,
      sessions_per_month: parsed.financeiro_sessions_per_month ?? null,
      sessions_custom: parsed.financeiro_sessions_custom ?? false,
      contract_duration_months: parsed.financeiro_contract_duration_months ?? null,
      contract_starts_on: parsed.financeiro_contract_starts_on ?? null,
      observacoes: parsed.financeiro_observacoes ?? null,
      pacote_qtd_sessoes: parsed.financeiro_pacote_qtd_sessoes ?? null,
      pacote_valor_cents: parsed.financeiro_pacote_valor_cents ?? null,
      registrar_pacote_pago: parsed.financeiro_registrar_pacote_pago ?? false,
    });
  }

  if (!parsed.financeiro_modelo) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Defina o contrato financeiro do paciente (particular/convênio e forma de cobrança).',
      statusCode: 400,
    });
  }

  const billing: FinanceBillingType = parsed.financeiro_modelo === 'pacote' ? 'PACOTE' : 'AVULSO';
  const valor = parsed.financeiro_valor_acordado_cents
    ?? parsed.financeiro_valor_sessao_cents
    ?? parsed.financeiro_pacote_valor_cents
    ?? 0;

  return FinancialContractInputSchema.parse({
    patient_id: '00000000-0000-0000-0000-000000000000',
    model_type: 'PARTICULAR',
    billing_type: billing,
    valor_acordado_cents: valor,
    due_day: parsed.financeiro_due_day ?? null,
    sessions_per_month: parsed.financeiro_sessions_per_month ?? parsed.financeiro_pacote_qtd_sessoes ?? null,
    sessions_custom: parsed.financeiro_sessions_custom ?? false,
    contract_duration_months: parsed.financeiro_contract_duration_months ?? null,
    contract_starts_on: parsed.financeiro_contract_starts_on ?? null,
    observacoes: parsed.financeiro_observacoes ?? null,
    pacote_qtd_sessoes: parsed.financeiro_pacote_qtd_sessoes ?? null,
    pacote_valor_cents: parsed.financeiro_pacote_valor_cents ?? null,
    registrar_pacote_pago: parsed.financeiro_registrar_pacote_pago ?? false,
  });
}

export function assertContractRules(input: FinancialContractInput): void {
  if (input.billing_type === 'MENSAL_RECORRENTE') {
    if (input.due_day == null) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Mensalidade exige o dia de vencimento (1 a 28).',
        statusCode: 400,
        details: { due_day: ['Obrigatório no mensal recorrente'] },
      });
    }
    if (input.sessions_per_month == null && !input.sessions_custom) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Informe a quantidade de sessões por mês ou marque como personalizado.',
        statusCode: 400,
        details: { sessions_per_month: ['Obrigatório no mensal recorrente'] },
      });
    }
  }
  if (input.billing_type === 'PACOTE') {
    if (!input.pacote_qtd_sessoes || input.pacote_valor_cents == null) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Pacote exige quantidade de sessões e valor total.',
        statusCode: 400,
      });
    }
  }
}

function materialFieldsChanged(
  current: Record<string, unknown>,
  next: FinancialContractInput,
): boolean {
  return (
    current.model_type !== next.model_type ||
    current.billing_type !== next.billing_type ||
    Number(current.valor_acordado_cents ?? 0) !== next.valor_acordado_cents ||
    Number(current.due_day ?? 0) !== Number(next.due_day ?? 0) ||
    Number(current.sessions_per_month ?? 0) !== Number(next.sessions_per_month ?? 0) ||
    Number(current.contract_duration_months ?? 0) !== Number(next.contract_duration_months ?? 0)
  );
}

export async function countContractWindows(contractId: string): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from('financeiro_contrato_janelas')
    .select('id', { count: 'exact', head: true })
    .eq('contract_id', contractId)
    .is('deleted_at', null);
  return count ?? 0;
}

export async function getFinancialContract(patientId: string, clinicId: string) {
  const supabase = createServiceClient();
  const { data: contract } = await supabase
    .from('financeiro_planos_paciente')
    .select('*')
    .eq('patient_id', patientId)
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!contract) {
    return {
      contract: null,
      janelas: [] as unknown[],
      janelas_count: 0,
      needs_windows: false,
      next_step: null as string | null,
    };
  }

  const { data: janelas } = await supabase
    .from('financeiro_contrato_janelas')
    .select('id, weekday, start_time, duration_minutes, timezone')
    .eq('contract_id', contract.id)
    .is('deleted_at', null)
    .order('weekday')
    .order('start_time');

  const janelasCount = janelas?.length ?? 0;
  const needsWindows = contract.billing_type === 'MENSAL_RECORRENTE' && janelasCount === 0;

  return {
    contract,
    janelas: janelas ?? [],
    janelas_count: janelasCount,
    needs_windows: needsWindows,
    next_step: needsWindows ? 'define_schedule_windows' : null,
  };
}

export async function upsertFinancialContract(params: {
  clinicId: string;
  professionalId: string | null;
  createdBy: string;
  input: FinancialContractInput;
}): Promise<{
  contract: Record<string, unknown>;
  archived_contract_id: string | null;
  needs_windows: boolean;
  next_step: string | null;
  package_tx_id: string | null;
  janelas_count: number;
}> {
  assertContractRules(params.input);
  const supabase = createServiceClient();

  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', params.input.patient_id)
    .eq('clinic_id', params.clinicId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const row = {
    clinic_id: params.clinicId,
    patient_id: params.input.patient_id,
    professional_id: params.professionalId,
    modelo: legacyModeloFromContract(params.input),
    model_type: params.input.model_type,
    billing_type: params.input.billing_type,
    valor_acordado_cents: params.input.valor_acordado_cents,
    valor_sessao_cents: params.input.billing_type === 'PACOTE'
      ? Math.round(
        Number(params.input.pacote_valor_cents ?? params.input.valor_acordado_cents) /
          Number(params.input.pacote_qtd_sessoes ?? 1),
      )
      : params.input.valor_acordado_cents,
    due_day: params.input.billing_type === 'MENSAL_RECORRENTE' ? params.input.due_day : null,
    sessions_per_month: params.input.sessions_per_month ?? params.input.pacote_qtd_sessoes ?? null,
    sessions_custom: params.input.sessions_custom ?? false,
    contract_duration_months: params.input.contract_duration_months ?? null,
    contract_starts_on: params.input.contract_starts_on ?? today,
    ativo: true,
    pacote_qtd_sessoes: params.input.billing_type === 'PACOTE' ? params.input.pacote_qtd_sessoes : null,
    pacote_valor_cents: params.input.billing_type === 'PACOTE' ? params.input.pacote_valor_cents : null,
    observacoes: params.input.observacoes ?? null,
    created_by: params.createdBy,
    deleted_at: null,
  };

  const { data: existing } = await supabase
    .from('financeiro_planos_paciente')
    .select('*')
    .eq('patient_id', params.input.patient_id)
    .eq('clinic_id', params.clinicId)
    .is('deleted_at', null)
    .maybeSingle();

  let archivedId: string | null = null;
  let contract: Record<string, unknown>;

  if (existing) {
    const { count } = await supabase
      .from('financeiro_transacoes')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', params.clinicId)
      .eq('contract_id', existing.id)
      .neq('status', 'CANCELADO')
      .is('deleted_at', null);

    const hasInvoices = (count ?? 0) > 0;
    if (hasInvoices && materialFieldsChanged(existing as Record<string, unknown>, params.input)) {
      const now = new Date().toISOString();
      const { error: archiveErr } = await supabase
        .from('financeiro_planos_paciente')
        .update({ deleted_at: now, ativo: false })
        .eq('id', existing.id)
        .eq('clinic_id', params.clinicId);
      if (archiveErr) {
        throw new AppError({ code: 'ARCHIVE_FAILED', message: archiveErr.message, statusCode: 500 });
      }
      archivedId = existing.id as string;
      const inserted = await supabase.from('financeiro_planos_paciente').insert(row).select('*').single();
      if (inserted.error) {
        throw new AppError({ code: 'CREATE_FAILED', message: inserted.error.message, statusCode: 500 });
      }
      contract = inserted.data as Record<string, unknown>;
    } else {
      const updated = await supabase
        .from('financeiro_planos_paciente')
        .update(row)
        .eq('id', existing.id)
        .eq('clinic_id', params.clinicId)
        .select('*')
        .single();
      if (updated.error) {
        throw new AppError({ code: 'UPDATE_FAILED', message: updated.error.message, statusCode: 500 });
      }
      contract = updated.data as Record<string, unknown>;
    }
  } else {
    const inserted = await supabase.from('financeiro_planos_paciente').insert(row).select('*').single();
    if (inserted.error) {
      throw new AppError({ code: 'CREATE_FAILED', message: inserted.error.message, statusCode: 500 });
    }
    contract = inserted.data as Record<string, unknown>;
  }

  let packageTxId: string | null = null;
  if (
    params.input.billing_type === 'PACOTE' &&
    params.input.registrar_pacote_pago &&
    params.input.pacote_qtd_sessoes &&
    params.input.pacote_valor_cents != null
  ) {
    const { data: txId, error: rpcErr } = await supabase.rpc('financeiro_vender_pacote', {
      p_clinic_id: params.clinicId,
      p_patient_id: params.input.patient_id,
      p_professional_id: params.professionalId,
      p_qtd: params.input.pacote_qtd_sessoes,
      p_valor_cents: params.input.pacote_valor_cents,
      p_descricao: `Pacote de ${params.input.pacote_qtd_sessoes} sessões`,
      p_created_by: params.createdBy,
    });
    if (rpcErr) {
      throw new AppError({ code: 'PACKAGE_SALE_FAILED', message: rpcErr.message, statusCode: 500 });
    }
    packageTxId = txId as string;
  }

  const janelasCount = await countContractWindows(String(contract.id));
  const needsWindows = params.input.billing_type === 'MENSAL_RECORRENTE' && janelasCount === 0;

  return {
    contract,
    archived_contract_id: archivedId,
    needs_windows: needsWindows,
    next_step: needsWindows ? 'define_schedule_windows' : null,
    package_tx_id: packageTxId,
    janelas_count: janelasCount,
  };
}

export const RecurrenceWindowInputSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  duration_minutes: z.number().int().min(15).max(240).optional(),
  timezone: z.string().min(3).max(64).optional(),
});

export const RecurrenceWindowsPayloadSchema = z.object({
  patient_id: z.string().uuid(),
  janelas: z.array(RecurrenceWindowInputSchema).min(1).max(14),
});

const RPC_ERROR_MAP: Record<string, { code: string; message: string; status: number }> = {
  CONTRACT_NOT_FOUND: { code: 'CONTRACT_NOT_FOUND', message: 'Contrato financeiro não encontrado', status: 404 },
  CONTRACT_NOT_RECURRING: { code: 'CONTRACT_NOT_RECURRING', message: 'Só contratos mensais recorrentes aceitam janelas de agenda', status: 409 },
  WINDOWS_REQUIRED: { code: 'WINDOWS_REQUIRED', message: 'Informe ao menos um horário semanal', status: 400 },
  WINDOW_INVALID: { code: 'WINDOW_INVALID', message: 'Horário inválido. Use dia da semana (1–7) e hora HH:MM', status: 400 },
  WINDOW_DUPLICATE: { code: 'WINDOW_DUPLICATE', message: 'Há horários duplicados no mesmo dia', status: 400 },
};

function mapRecurrenceRpcError(message: string): AppError {
  for (const [token, mapped] of Object.entries(RPC_ERROR_MAP)) {
    if (message.includes(token)) {
      return new AppError({ code: mapped.code, message: mapped.message, statusCode: mapped.status });
    }
  }
  return new AppError({ code: 'RECURRENCE_FAILED', message, statusCode: 500 });
}

export async function syncRecurrenceWindows(params: {
  clinicId: string;
  createdBy: string;
  patientId: string;
  janelas: z.infer<typeof RecurrenceWindowInputSchema>[];
}) {
  const supabase = createServiceClient();
  const { data: contract } = await supabase
    .from('financeiro_planos_paciente')
    .select('id, billing_type, ativo')
    .eq('patient_id', params.patientId)
    .eq('clinic_id', params.clinicId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!contract) {
    throw new AppError({ code: 'CONTRACT_NOT_FOUND', message: 'Contrato financeiro não encontrado', statusCode: 404 });
  }
  if (contract.billing_type !== 'MENSAL_RECORRENTE' || contract.ativo === false) {
    throw new AppError({
      code: 'CONTRACT_NOT_RECURRING',
      message: 'Só contratos mensais recorrentes aceitam janelas de agenda',
      statusCode: 409,
    });
  }

  const { data, error } = await supabase.rpc('financeiro_sincronizar_recorrencia', {
    p_clinic_id: params.clinicId,
    p_contract_id: contract.id,
    p_janelas: params.janelas,
    p_created_by: params.createdBy,
  });
  if (error) throw mapRecurrenceRpcError(error.message);

  const detail = await getFinancialContract(params.patientId, params.clinicId);
  return {
    ...detail,
    sync: data as Record<string, unknown>,
  };
}
