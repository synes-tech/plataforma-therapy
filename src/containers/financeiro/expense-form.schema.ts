import { z } from 'zod';
import type { FinanceCustoRecorrente, FinanceExpenseKind } from './financeiro.types';
import { reaisInputToCents } from './financeiro.types';

export interface ExpenseFormValues {
  id?: string;
  kind: FinanceExpenseKind;
  descricao: string;
  valor: string;
  dia_vencimento: string;
  starts_on: string;
  months_total: string;
  data_vencimento: string;
  is_already_paid: boolean;
  categoria: FinanceCustoRecorrente['categoria'];
  observacoes: string;
}

export const EMPTY_EXPENSE_FORM: ExpenseFormValues = {
  id: undefined,
  kind: 'FIXA',
  descricao: '',
  valor: '',
  dia_vencimento: '10',
  starts_on: new Date().toISOString().slice(0, 7),
  months_total: '12',
  data_vencimento: new Date().toISOString().slice(0, 10),
  is_already_paid: false,
  categoria: 'CUSTO_FIXO',
  observacoes: '',
};

export const ExpenseFormSchema = z
  .object({
    id: z.string().optional(),
    kind: z.enum(['FIXA', 'VARIAVEL_PARCELADA', 'PONTUAL']),
    descricao: z.string().trim().min(2, 'Informe a descrição da despesa.'),
    valor: z.string(),
    dia_vencimento: z.string(),
    starts_on: z.string(),
    months_total: z.string(),
    data_vencimento: z.string(),
    is_already_paid: z.boolean(),
    categoria: z.string(),
    observacoes: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.valor.trim() || reaisInputToCents(data.valor) <= 0) {
      ctx.addIssue({ code: 'custom', path: ['valor'], message: 'Informe o valor da despesa.' });
    }
    if (data.kind !== 'PONTUAL') {
      const due = Number(data.dia_vencimento);
      if (!Number.isInteger(due) || due < 1 || due > 28) {
        ctx.addIssue({ code: 'custom', path: ['dia_vencimento'], message: 'Informe o dia de vencimento (1 a 28).' });
      }
    }
    if (data.kind === 'VARIAVEL_PARCELADA' && !data.id) {
      if (!/^\d{4}-\d{2}$/.test(data.starts_on)) {
        ctx.addIssue({ code: 'custom', path: ['starts_on'], message: 'Informe o mês da primeira parcela.' });
      }
      const months = Number(data.months_total);
      if (!Number.isInteger(months) || months < 2 || months > 60) {
        ctx.addIssue({
          code: 'custom',
          path: ['months_total'],
          message: 'Informe entre 2 e 60 parcelas.',
        });
      }
    }
    if (data.kind === 'PONTUAL' && !data.data_vencimento) {
      ctx.addIssue({ code: 'custom', path: ['data_vencimento'], message: 'Informe a data de vencimento.' });
    }
  });

export function validateExpenseForm(value: ExpenseFormValues): { valid: boolean; errors: Record<string, string> } {
  const parsed = ExpenseFormSchema.safeParse(value);
  if (parsed.success) return { valid: true, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!errors[key]) errors[key] = issue.message;
  }
  return { valid: false, errors };
}

export function expenseFormToPayload(form: ExpenseFormValues) {
  return {
    action: 'upsert_custo_recorrente' as const,
    id: form.id,
    kind: form.kind,
    descricao: form.descricao.trim(),
    valor_cents: reaisInputToCents(form.valor),
    dia_vencimento: Math.min(28, Math.max(1, Number(form.dia_vencimento) || 1)),
    starts_on: form.kind === 'VARIAVEL_PARCELADA' ? `${form.starts_on}-01` : null,
    months_total: form.kind === 'VARIAVEL_PARCELADA' ? Number(form.months_total) || null : null,
    data_vencimento: form.kind === 'PONTUAL' ? form.data_vencimento : null,
    is_already_paid: form.kind === 'PONTUAL' ? form.is_already_paid : false,
    categoria:
      form.kind === 'VARIAVEL_PARCELADA'
        ? 'DESPESA_PARCELADA'
        : form.kind === 'PONTUAL'
          ? 'DESPESA_PONTUAL'
          : form.categoria,
    observacoes: form.observacoes.trim() || null,
    ativo: true,
  };
}
