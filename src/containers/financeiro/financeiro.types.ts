export type FinanceModelo = 'avulso' | 'pacote' | 'social';
export type FinanceTipo = 'ENTRADA' | 'SAIDA';
export type FinanceStatus = 'PAGO' | 'PENDENTE' | 'ATRASADO' | 'CANCELADO';

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
  created_at: string;
}

export interface FinancePatientPlanRow {
  patient_id: string;
  patient_name: string;
  plan: {
    id: string;
    modelo: FinanceModelo;
    valor_sessao_cents: number;
    pacote_qtd_sessoes: number | null;
    pacote_valor_cents: number | null;
    observacoes: string | null;
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
  categoria: 'CUSTO_FIXO' | 'IMPOSTO' | 'OUTROS';
  valor_cents: number;
  dia_vencimento: number;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface FinanceCustoTitulo extends FinanceTransacao {
  recorrente?: boolean;
  recorrencia_chave?: string | null;
}

export interface FinanceCustosResponse {
  mode: 'custos';
  month: string;
  templates: FinanceCustoRecorrente[];
  titulos_mes: FinanceCustoTitulo[];
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
