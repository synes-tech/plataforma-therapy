import type { FinanceStatus, FinanceTransacao } from '@containers/financeiro/financeiro.types';

export type SessionHistoryKind = 'mensalidade' | 'avulsa' | 'extra' | 'pacote' | 'sessao';

export interface FinanceSessionCharge {
  id: string;
  status_cobranca: string;
  valor_previsto_cents: number;
  schedule_id?: string | null;
  transacao_id?: string | null;
  created_at: string;
  therapist_schedule?: {
    scheduled_at?: string | null;
    status?: string | null;
    title?: string | null;
  } | null;
}

export interface PatientSessionHistoryItem {
  id: string;
  date: string;
  title: string;
  kind: SessionHistoryKind;
  kindLabel: string;
  status: FinanceStatus | 'INCLUIDO' | 'PACOTE' | 'CONFIRMACAO';
  statusLabel: string;
  badgeClass: string;
  valor_cents: number;
  payable: boolean;
  transacao?: FinanceTransacao;
}

const KIND_FROM_CATEGORY: Record<string, { kind: SessionHistoryKind; label: string }> = {
  MENSALIDADE: { kind: 'mensalidade', label: 'Mensalidade' },
  CONVENIO_MENSAL: { kind: 'mensalidade', label: 'Mensalidade' },
  SESSAO_AVULSA: { kind: 'avulsa', label: 'Avulsa' },
  CONVENIO_AVULSO: { kind: 'avulsa', label: 'Avulsa' },
  SESSAO_MANUAL: { kind: 'extra', label: 'Sessão extra' },
  SESSAO_SOCIAL: { kind: 'avulsa', label: 'Social' },
  PACOTE: { kind: 'pacote', label: 'Pacote' },
};

const STATUS_BADGE = {
  PENDENTE: { label: 'A receber', className: 'bg-amber-50 text-amber-800' },
  ATRASADO: { label: 'Atrasado', className: 'bg-red-50 text-red-700' },
  PAGO: { label: 'Pago', className: 'bg-emerald-50 text-emerald-700' },
  CANCELADO: { label: 'Cancelado', className: 'bg-slate-100 text-slate-500' },
  INCLUIDO: { label: 'Na mensalidade', className: 'bg-primary-50 text-primary' },
  PACOTE: { label: 'No pacote', className: 'bg-sky-50 text-sky-800' },
  CONFIRMACAO: { label: 'Confirmar sessão', className: 'bg-amber-50 text-amber-800' },
} as const;

function statusBadge(key: keyof typeof STATUS_BADGE) {
  return STATUS_BADGE[key];
}

export function chargeKind(categoria: string): { kind: SessionHistoryKind; label: string } {
  return KIND_FROM_CATEGORY[categoria] ?? { kind: 'sessao', label: 'Lançamento' };
}

function chargeToHistory(charge: FinanceSessionCharge): PatientSessionHistoryItem | null {
  if (['CANCELADO', 'NAO_REALIZADO', 'REMARCADO'].includes(charge.status_cobranca)) return null;
  const date = charge.therapist_schedule?.scheduled_at ?? charge.created_at;
  const title = charge.therapist_schedule?.title?.trim() || 'Sessão';

  if (charge.status_cobranca === 'CONSUMIDO_PACOTE') {
    return {
      id: `charge-${charge.id}`,
      date,
      title,
      kind: 'pacote',
      kindLabel: 'Pacote',
      status: 'PACOTE',
      statusLabel: statusBadge('PACOTE').label,
      badgeClass: statusBadge('PACOTE').className,
      valor_cents: charge.valor_previsto_cents,
      payable: false,
    };
  }

  if (charge.status_cobranca === 'INCLUIDO_MENSALIDADE' || charge.status_cobranca === 'AGUARDANDO_SESSAO') {
    return {
      id: `charge-${charge.id}`,
      date,
      title,
      kind: 'sessao',
      kindLabel: 'Na mensalidade',
      status: 'INCLUIDO',
      statusLabel: statusBadge('INCLUIDO').label,
      badgeClass: statusBadge('INCLUIDO').className,
      valor_cents: 0,
      payable: false,
    };
  }

  if (charge.status_cobranca === 'PENDENTE_CONFIRMACAO') {
    return {
      id: `charge-${charge.id}`,
      date,
      title,
      kind: 'sessao',
      kindLabel: 'Sessão',
      status: 'CONFIRMACAO',
      statusLabel: statusBadge('CONFIRMACAO').label,
      badgeClass: statusBadge('CONFIRMACAO').className,
      valor_cents: charge.valor_previsto_cents,
      payable: false,
    };
  }

  if (charge.status_cobranca === 'CORTESIA') {
    return {
      id: `charge-${charge.id}`,
      date,
      title,
      kind: 'sessao',
      kindLabel: 'Cortesia',
      status: 'PAGO',
      statusLabel: 'Cortesia',
      badgeClass: statusBadge('PAGO').className,
      valor_cents: 0,
      payable: false,
    };
  }

  return null;
}

export function buildPatientSessionTimeline(
  transacoes: FinanceTransacao[],
  cobrancas: FinanceSessionCharge[] = [],
): PatientSessionHistoryItem[] {
  const linkedTx = new Set(
    cobrancas.map((charge) => charge.transacao_id).filter((id): id is string => Boolean(id)),
  );

  const fromCharges = cobrancas
    .map(chargeToHistory)
    .filter((item): item is PatientSessionHistoryItem => Boolean(item));

  const fromTx = transacoes
    .filter((tx) => tx.tipo === 'ENTRADA' && tx.status !== 'CANCELADO' && !linkedTx.has(tx.id))
    .map((tx) => {
      const kind = chargeKind(tx.categoria);
      const badge = statusBadge(tx.status in STATUS_BADGE ? (tx.status as keyof typeof STATUS_BADGE) : 'PENDENTE');
      return {
        id: tx.id,
        date: tx.data_vencimento || tx.data_pagamento || tx.created_at,
        title: tx.descricao || kind.label,
        kind: kind.kind,
        kindLabel: kind.label,
        status: tx.status,
        statusLabel: badge.label,
        badgeClass: badge.className,
        valor_cents: tx.valor_cents,
        payable: tx.status === 'PENDENTE' || tx.status === 'ATRASADO',
        transacao: tx,
      } satisfies PatientSessionHistoryItem;
    });

  return [...fromCharges, ...fromTx].sort((a, b) => b.date.localeCompare(a.date));
}

export function groupHistoryByMonth(items: PatientSessionHistoryItem[]): Array<{
  monthKey: string;
  label: string;
  items: PatientSessionHistoryItem[];
}> {
  const groups = new Map<string, PatientSessionHistoryItem[]>();
  for (const item of items) {
    const key = item.date.slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([monthKey, groupItems]) => ({
    monthKey,
    label: formatMonthLabel(monthKey),
    items: groupItems,
  }));
}

export function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return yearMonth;
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
}

export function formatHistoryDate(value: string): string {
  const iso = value.includes('T') ? value : `${value.slice(0, 10)}T12:00:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
}
