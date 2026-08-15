export type FinanceModelo = 'avulso' | 'pacote' | 'social';
export type FinanceModelType = 'PARTICULAR' | 'CONVENIO';
export type FinanceBillingType = 'AVULSO' | 'MENSAL_RECORRENTE' | 'PACOTE';
export type FinanceTipo = 'ENTRADA' | 'SAIDA';
/** PENDENTE = "A Receber" na UI */
export type FinanceStatus = 'PAGO' | 'PENDENTE' | 'ATRASADO' | 'CANCELADO';
export type FinanceExpenseKind = 'FIXA' | 'VARIAVEL_PARCELADA' | 'PONTUAL';

export const EXPENSE_KIND_LABEL: Record<FinanceExpenseKind, string> = {
  FIXA: 'Fixa',
  VARIAVEL_PARCELADA: 'Parcelada',
  PONTUAL: 'Pontual',
};

export const EXPENSE_STATUS_LABEL: Record<FinanceStatus, string> = {
  PENDENTE: 'A pagar',
  PAGO: 'Pago',
  ATRASADO: 'Atrasado',
  CANCELADO: 'Cancelado',
};

export const STATUS_LABEL: Record<FinanceStatus, string> = {
  PENDENTE: 'A receber',
  PAGO: 'Pago',
  ATRASADO: 'Atrasado',
  CANCELADO: 'Cancelado',
};

export const MODEL_TYPE_LABEL: Record<FinanceModelType, string> = {
  PARTICULAR: 'Particular',
  CONVENIO: 'Convênio',
};

export const BILLING_TYPE_LABEL: Record<FinanceBillingType, string> = {
  AVULSO: 'Avulso',
  MENSAL_RECORRENTE: 'Mensal recorrente',
  PACOTE: 'Pacote',
};

export const CATEGORIA_LABEL: Record<string, string> = {
  MENSALIDADE: 'Mensalidade',
  CONVENIO_MENSAL: 'Convênio (mensal)',
  CONVENIO_AVULSO: 'Convênio (avulso)',
  SESSAO_AVULSA: 'Sessão avulsa',
  SESSAO_MANUAL: 'Sessão extra',
  SESSAO_SOCIAL: 'Sessão social',
  PACOTE: 'Pacote',
  RENDIMENTO_EXTRA: 'Rendimento extra',
};

export const STATUS_BADGE: Record<FinanceStatus, string> = {
  PENDENTE: 'bg-amber-50 text-amber-800',
  ATRASADO: 'bg-red-50 text-red-700',
  PAGO: 'bg-emerald-50 text-emerald-700',
  CANCELADO: 'bg-slate-100 text-slate-500',
};

export interface FinanceReceivableItem extends FinanceTransacao {
  metadata?: Record<string, unknown> | null;
}

export interface FinanceReceivablesResponse {
  mode: 'receivables';
  month: string;
  items: FinanceReceivableItem[];
  summary: {
    a_receber_cents: number;
    atrasado_cents: number;
    pago_cents: number;
    count_a_receber: number;
    count_atrasado: number;
    count_pago: number;
  };
}

export interface FinanceDashboard {
  month: string;
  receita_projetada_cents: number;
  receita_realizada_cents: number;
  despesas_cents: number;
  lucro_liquido_cents: number;
  tendencia: { month: string; receita: number; despesa: number }[];
  alertas: {
    sessoes_sem_status: number;
    sessoes_sem_status_total_cents: number;
    inadimplentes: number;
    inadimplentes_total_cents: number;
    vencimentos_7d: Array<{
      id: string;
      descricao: string;
      valor_cents: number;
      data_vencimento: string | null;
      tipo: string;
      status: string;
    }>;
  };
}

export interface FinanceTransacao {
  id: string;
  tipo: FinanceTipo;
  categoria: string;
  descricao: string;
  valor_cents: number;
  status: FinanceStatus;
  data_vencimento: string | null;
  data_pagamento: string | null;
  paciente_id: string | null;
  paciente_nome?: string | null;
  contract_id?: string | null;
  competence_month?: string | null;
  installment_current?: number | null;
  installment_total?: number | null;
  source?: string | null;
  created_at: string;
}

export interface FinanceContractWindow {
  id: string;
  weekday: number;
  start_time: string;
  duration_minutes: number;
}

export interface FinancePatientPlanRow {
  patient_id: string;
  patient_name: string;
  plan: {
    id: string;
    modelo: FinanceModelo;
    model_type?: FinanceModelType;
    billing_type?: FinanceBillingType;
    valor_sessao_cents: number;
    valor_acordado_cents?: number;
    due_day?: number | null;
    sessions_per_month?: number | null;
    sessions_custom?: boolean;
    contract_duration_months?: number | null;
    contract_starts_on?: string | null;
    pacote_qtd_sessoes: number | null;
    pacote_valor_cents: number | null;
    observacoes: string | null;
    janelas?: FinanceContractWindow[];
  } | null;
  sessoes_disponiveis: number;
}

export interface PaymentPrompt {
  schedule_id: string;
  patient_id: string;
  patient_name: string;
  modelo: string;
  saldo_sessoes: number;
  valor_sugerido_cents: number;
  pode_consumir_pacote: boolean;
}

export interface FinanceCustoRecorrente {
  id: string;
  descricao: string;
  categoria: 'CUSTO_FIXO' | 'CUSTO_VARIAVEL' | 'IMPOSTO' | 'DESPESA_PARCELADA' | 'DESPESA_PONTUAL' | 'OUTROS';
  kind?: FinanceExpenseKind;
  valor_cents: number;
  dia_vencimento: number;
  starts_on?: string | null;
  months_total?: number | null;
  ends_on?: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface FinanceCustoTitulo extends FinanceTransacao {
  recorrente?: boolean;
  recorrencia_chave?: string | null;
  parcela_label?: string | null;
}

export interface FinanceCustosResponse {
  mode: 'custos';
  month: string;
  templates: FinanceCustoRecorrente[];
  titulos_mes: FinanceCustoTitulo[];
  summary?: {
    a_pagar_cents: number;
    atrasado_cents: number;
    pago_cents: number;
    count_a_pagar: number;
    count_atrasado: number;
    count_pago: number;
  };
}

export interface PendingSessionItem {
  id: string;
  schedule_id: string;
  patient_id: string;
  patient_name: string;
  status_cobranca: string;
  valor_previsto_cents: number;
  modelo: string;
  sessoes_disponiveis: number;
  schedule: {
    scheduled_at: string;
    status: string;
    title: string | null;
    duration_minutes: number | null;
  } | null;
}

export const MODELO_LABEL: Record<FinanceModelo, string> = {
  avulso: 'Avulso',
  pacote: 'Pacote',
  social: 'Social',
};

export function centsToInputReais(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function reaisInputToCents(raw: string): number {
  const normalized = raw.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}
