import { z } from 'zod';
import { reaisInputToCents } from './financeiro.types';

export type IncomeCategoria = 'RENDIMENTO_EXTRA' | 'OUTROS';

export interface IncomeFormValues {
  descricao: string;
  valor: string;
  categoria: IncomeCategoria;
  data_vencimento: string;
  is_already_paid: boolean;
  forma_pagamento: 'pix' | 'cartao' | 'dinheiro' | 'outro';
  paciente_id: string;
  observacoes: string;
}

export const EMPTY_INCOME_FORM: IncomeFormValues = {
  descricao: '',
  valor: '',
  categoria: 'RENDIMENTO_EXTRA',
  data_vencimento: new Date().toISOString().slice(0, 10),
  is_already_paid: false,
  forma_pagamento: 'pix',
  paciente_id: '',
  observacoes: '',
};

export const IncomeFormSchema = z
  .object({
    descricao: z.string().trim().min(2, 'Informe a descrição da receita.'),
    valor: z.string(),
    categoria: z.enum(['RENDIMENTO_EXTRA', 'OUTROS']),
    data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data de vencimento.'),
    is_already_paid: z.boolean(),
    forma_pagamento: z.enum(['pix', 'cartao', 'dinheiro', 'outro']),
    paciente_id: z.string(),
    observacoes: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.valor.trim() || reaisInputToCents(data.valor) <= 0) {
      ctx.addIssue({ code: 'custom', path: ['valor'], message: 'Informe o valor da receita.' });
    }
  });

export function validateIncomeForm(value: IncomeFormValues): { valid: boolean; errors: Record<string, string> } {
  const parsed = IncomeFormSchema.safeParse(value);
  if (parsed.success) return { valid: true, errors: {} };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!errors[key]) errors[key] = issue.message;
  }
  return { valid: false, errors };
}

export function incomeFormToPayload(form: IncomeFormValues) {
  const due = form.data_vencimento;
  const today = new Date().toISOString().slice(0, 10);
  const paid = form.is_already_paid;
  return {
    action: 'upsert_tx' as const,
    tipo: 'ENTRADA' as const,
    categoria: form.categoria,
    descricao: form.descricao.trim(),
    valor_cents: reaisInputToCents(form.valor),
    status: paid ? ('PAGO' as const) : due < today ? ('ATRASADO' as const) : ('PENDENTE' as const),
    data_vencimento: due,
    data_pagamento: paid ? due : null,
    paciente_id: form.paciente_id || null,
    metadata: {
      observacoes: form.observacoes.trim() || null,
      forma_pagamento: paid ? form.forma_pagamento : null,
      source: 'manual_income',
    },
  };
}
