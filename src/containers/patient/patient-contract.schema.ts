import { z } from 'zod';
import {
  centsToInputReais,
  reaisInputToCents,
  type FinanceBillingType,
  type FinanceModelType,
} from '@containers/financeiro/financeiro.types';
import { EMPTY_CONTRACT_FORM, type PatientContractFormValues } from './PatientContractFields';

export const ContractFormSchema = z
  .object({
    model_type: z
      .string()
      .min(1, 'Selecione se o atendimento é particular ou convênio.')
      .pipe(z.enum(['PARTICULAR', 'CONVENIO'])),
    billing_type: z
      .string()
      .min(1, 'Selecione como o paciente será cobrado.')
      .pipe(z.enum(['AVULSO', 'MENSAL_RECORRENTE', 'PACOTE'])),
    valor: z.string(),
    due_day: z.string(),
    sessions_per_month: z.string(),
    sessions_custom: z.boolean(),
    duration_months: z.string(),
    pacote_qtd: z.string(),
    pacote_valor: z.string(),
    registrar_pacote_pago: z.boolean(),
    observacoes: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.billing_type === 'MENSAL_RECORRENTE') {
      if (reaisInputToCents(data.valor) < 0 || !data.valor.trim()) {
        ctx.addIssue({ code: 'custom', path: ['valor'], message: 'Informe o valor mensal acordado.' });
      }
      const due = Number(data.due_day);
      if (!Number.isInteger(due) || due < 1 || due > 28) {
        ctx.addIssue({ code: 'custom', path: ['due_day'], message: 'Informe o dia de vencimento (1 a 28).' });
      }
      if (!data.sessions_custom) {
        const qtd = Number(data.sessions_per_month);
        if (!Number.isFinite(qtd) || qtd < 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['sessions_per_month'],
            message: 'Informe quantas sessões por mês.',
          });
        }
      }
    }
    if (data.billing_type === 'AVULSO' && (!data.valor.trim() || reaisInputToCents(data.valor) < 0)) {
      ctx.addIssue({ code: 'custom', path: ['valor'], message: 'Informe o valor da sessão.' });
    }
    if (data.billing_type === 'PACOTE') {
      const qtd = Number(data.pacote_qtd);
      if (!Number.isFinite(qtd) || qtd < 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['pacote_qtd'],
          message: 'Informe a quantidade de sessões do pacote.',
        });
      }
      if (!data.pacote_valor.trim()) {
        ctx.addIssue({ code: 'custom', path: ['pacote_valor'], message: 'Informe o valor do pacote.' });
      }
    }
  });

export function validateContractForm(value: PatientContractFormValues): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const parsed = ContractFormSchema.safeParse(value);
  if (parsed.success) return { valid: true, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!errors[key]) errors[key] = issue.message;
  }
  return { valid: false, errors };
}

export function anamnesisToContractForm(form: {
  financeiro_model_type: PatientContractFormValues['model_type'];
  financeiro_billing_type: PatientContractFormValues['billing_type'];
  financeiro_valor_sessao: string;
  financeiro_due_day: string;
  financeiro_sessions_per_month: string;
  financeiro_sessions_custom: boolean;
  financeiro_duration_months: string;
  financeiro_pacote_qtd: string;
  financeiro_pacote_valor: string;
  financeiro_registrar_pacote_pago: boolean;
  financeiro_observacoes: string;
}): PatientContractFormValues {
  return {
    model_type: form.financeiro_model_type,
    billing_type: form.financeiro_billing_type,
    valor: form.financeiro_valor_sessao,
    due_day: form.financeiro_due_day,
    sessions_per_month: form.financeiro_sessions_per_month,
    sessions_custom: form.financeiro_sessions_custom,
    duration_months: form.financeiro_duration_months,
    pacote_qtd: form.financeiro_pacote_qtd,
    pacote_valor: form.financeiro_pacote_valor,
    registrar_pacote_pago: form.financeiro_registrar_pacote_pago,
    observacoes: form.financeiro_observacoes,
  };
}

export function contractToForm(plan: {
  model_type?: FinanceModelType;
  billing_type?: FinanceBillingType;
  modelo?: string;
  valor_acordado_cents?: number;
  valor_sessao_cents?: number;
  due_day?: number | null;
  sessions_per_month?: number | null;
  sessions_custom?: boolean;
  contract_duration_months?: number | null;
  pacote_qtd_sessoes?: number | null;
  pacote_valor_cents?: number | null;
  observacoes?: string | null;
} | null): PatientContractFormValues {
  if (!plan) return { ...EMPTY_CONTRACT_FORM };
  return {
    model_type: plan.model_type ?? 'PARTICULAR',
    billing_type: plan.billing_type ?? (plan.modelo === 'pacote' ? 'PACOTE' : 'AVULSO'),
    valor: centsToInputReais(plan.valor_acordado_cents ?? plan.valor_sessao_cents ?? 0),
    due_day: plan.due_day ? String(plan.due_day) : '10',
    sessions_per_month: plan.sessions_per_month ? String(plan.sessions_per_month) : '4',
    sessions_custom: Boolean(plan.sessions_custom),
    duration_months: plan.contract_duration_months ? String(plan.contract_duration_months) : '',
    pacote_qtd: plan.pacote_qtd_sessoes ? String(plan.pacote_qtd_sessoes) : '4',
    pacote_valor: plan.pacote_valor_cents != null ? centsToInputReais(plan.pacote_valor_cents) : '600,00',
    registrar_pacote_pago: false,
    observacoes: plan.observacoes ?? '',
  };
}

export function contractFormToPayload(patientId: string, form: PatientContractFormValues) {
  return {
    action: 'upsert_plan' as const,
    patient_id: patientId,
    model_type: form.model_type || 'PARTICULAR',
    billing_type: form.billing_type || 'AVULSO',
    valor_acordado_cents: reaisInputToCents(form.valor),
    due_day: form.billing_type === 'MENSAL_RECORRENTE' ? Number(form.due_day) || null : null,
    sessions_per_month: form.sessions_custom ? null : Number(form.sessions_per_month) || null,
    sessions_custom: form.sessions_custom,
    contract_duration_months: Number(form.duration_months) || null,
    pacote_qtd_sessoes: form.billing_type === 'PACOTE' ? Number(form.pacote_qtd) || null : null,
    pacote_valor_cents: form.billing_type === 'PACOTE' ? reaisInputToCents(form.pacote_valor) : null,
    registrar_pacote_pago: form.billing_type === 'PACOTE' ? form.registrar_pacote_pago : false,
    observacoes: form.observacoes.trim() || null,
  };
}

export function contractSummary(form: PatientContractFormValues): string | null {
  if (!form.model_type || !form.billing_type) return null;
  const who = form.model_type === 'CONVENIO' ? 'Convênio' : 'Particular';
  if (form.billing_type === 'MENSAL_RECORRENTE') {
    const sessions = form.sessions_custom ? 'sessões variáveis' : `${form.sessions_per_month || '—'} sessões/mês`;
    return `${who} · Mensal · R$ ${form.valor || '—'} · vence dia ${form.due_day || '—'} · ${sessions}`;
  }
  if (form.billing_type === 'PACOTE') {
    return `${who} · Pacote · ${form.pacote_qtd || '—'} sessões · R$ ${form.pacote_valor || '—'}`;
  }
  return `${who} · Avulso · R$ ${form.valor || '—'} por sessão`;
}

export type PackageAutoFillChanged = 'session' | 'quantity' | 'package';

/** Cruza valor da sessão, quantidade e total do pacote — um lado preenche o outro. */
export function applyPackageAutoFill(input: {
  sessionValue: string;
  quantity: string;
  packageValue: string;
  changed: PackageAutoFillChanged;
}): { sessionValue: string; packageValue: string } {
  const qty = Number.parseInt(input.quantity.trim(), 10);
  if (!Number.isInteger(qty) || qty < 1) {
    return { sessionValue: input.sessionValue, packageValue: input.packageValue };
  }

  const sessionCents = reaisInputToCents(input.sessionValue);
  const packageCents = reaisInputToCents(input.packageValue);

  if (input.changed === 'session') {
    if (sessionCents <= 0) {
      return { sessionValue: input.sessionValue, packageValue: input.packageValue };
    }
    return {
      sessionValue: input.sessionValue,
      packageValue: centsToInputReais(sessionCents * qty),
    };
  }

  if (input.changed === 'package') {
    if (packageCents <= 0) {
      return { sessionValue: input.sessionValue, packageValue: input.packageValue };
    }
    return {
      sessionValue: centsToInputReais(Math.round(packageCents / qty)),
      packageValue: input.packageValue,
    };
  }

  if (sessionCents > 0) {
    return {
      sessionValue: input.sessionValue,
      packageValue: centsToInputReais(sessionCents * qty),
    };
  }

  if (packageCents > 0) {
    return {
      sessionValue: centsToInputReais(Math.round(packageCents / qty)),
      packageValue: input.packageValue,
    };
  }

  return { sessionValue: input.sessionValue, packageValue: input.packageValue };
}
