import { CATEGORIA_LABEL } from './financeiro.types';
import type { FinancePatientPlanRow, FinanceReceivableItem, FinanceCustoTitulo } from './financeiro.types';

export const CHART_PALETTE = {
  primary: '#1A86E2',
  mint: '#10B981',
  ai: '#7C3AED',
  alert: '#F59E0B',
  error: '#EF4444',
  slate: '#94A3B8',
  sky: '#0EA5E9',
  charcoal: '#0F172A',
} as const;

export const CATEGORY_COLORS = [
  CHART_PALETTE.primary,
  CHART_PALETTE.mint,
  CHART_PALETTE.ai,
  CHART_PALETTE.alert,
  CHART_PALETTE.sky,
  CHART_PALETTE.error,
  CHART_PALETTE.slate,
];

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTH_LONG = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export interface NamedCents {
  key: string;
  label: string;
  cents: number;
}

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutSegment {
  id: string;
  label: string;
  color: string;
  value: number;
  d: string;
}

export interface TrendPoint {
  month: string;
  label: string;
  receita: number;
  despesa: number;
  lucro: number;
}

export function clampRate(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.round((part / total) * 100));
}

export function signedDelta(current: number, previous: number): { cents: number; pct: number | null } {
  const cents = current - previous;
  if (previous === 0) return { cents, pct: current === 0 ? 0 : null };
  return { cents, pct: Math.round((cents / Math.abs(previous)) * 100) };
}

export function monthParts(yyyyMm: string): { year: number; monthIndex: number } | null {
  const [yearRaw, monthRaw] = yyyyMm.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex };
}

export function monthShortLabel(yyyyMm: string): string {
  const parts = monthParts(yyyyMm);
  return parts ? MONTH_SHORT[parts.monthIndex] ?? yyyyMm.slice(5) : yyyyMm.slice(5);
}

export function monthLongLabel(yyyyMm: string): string {
  const parts = monthParts(yyyyMm);
  if (!parts) return yyyyMm;
  return `${MONTH_LONG[parts.monthIndex] ?? yyyyMm} de ${parts.year}`;
}

export function financeiroPageTitle(
  tab: 'executivo' | 'recebimentos' | 'custos' | 'planos' | 'classificar' | 'extrato',
  yyyyMm: string,
): string {
  if (tab === 'executivo') return `Financeiro - Visão de ${monthLongLabel(yyyyMm)}`;
  if (tab === 'recebimentos') return 'Financeiro - Receitas';
  if (tab === 'custos') return 'Financeiro - Despesas';
  if (tab === 'planos') return 'Financeiro - Pacientes & planos';
  if (tab === 'classificar') return 'Financeiro - Sessões a classificar';
  return 'Financeiro - Extrato';
}

export function previousMonthKey(yyyyMm: string): string {
  const parts = monthParts(yyyyMm);
  if (!parts) return yyyyMm;
  const date = new Date(parts.year, parts.monthIndex - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatCompactCurrency(cents: number): string {
  const reais = (cents ?? 0) / 100;
  const abs = Math.abs(reais);
  const sign = reais < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  }
  if (abs >= 1000) {
    return `${sign}R$ ${(abs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reais);
}

export function groupCentsByKey<T>(
  items: T[],
  keyFn: (item: T) => string,
  valueFn: (item: T) => number,
): { key: string; cents: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item) || 'OUTROS';
    map.set(key, (map.get(key) ?? 0) + valueFn(item));
  }
  return [...map.entries()]
    .map(([key, cents]) => ({ key, cents }))
    .sort((a, b) => b.cents - a.cents);
}

export function toNamedCents(
  rows: { key: string; cents: number }[],
  labelFn: (key: string) => string,
  limit = 6,
): NamedCents[] {
  const head = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((sum, row) => sum + row.cents, 0);
  const named = head.map((row) => ({
    key: row.key,
    label: labelFn(row.key),
    cents: row.cents,
  }));
  if (rest > 0) named.push({ key: 'OUTROS_GRUPO', label: 'Outros', cents: rest });
  return named.filter((row) => row.cents > 0);
}

export function categoriaLabel(key: string): string {
  return CATEGORIA_LABEL[key] ?? key.replace(/_/g, ' ').toLowerCase();
}

export function toDonutSlices(rows: NamedCents[], colors: string[] = CATEGORY_COLORS): DonutSlice[] {
  return rows.map((row, index) => ({
    id: row.key,
    label: row.label,
    value: row.cents,
    color: colors[index % colors.length] ?? CHART_PALETTE.slate,
  }));
}

function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

export function donutSegments(
  slices: DonutSlice[],
  opts?: { cx?: number; cy?: number; outer?: number; inner?: number },
): DonutSegment[] {
  const cx = opts?.cx ?? 80;
  const cy = opts?.cy ?? 80;
  const outer = opts?.outer ?? 62;
  const inner = opts?.inner ?? 40;
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  if (total <= 0) return [];

  let angle = -Math.PI / 2;
  return slices
    .filter((slice) => slice.value > 0)
    .map((slice) => {
      const sweep = (slice.value / total) * Math.PI * 2;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      const large = sweep > Math.PI ? 1 : 0;
      const [x1, y1] = polar(cx, cy, outer, start);
      const [x2, y2] = polar(cx, cy, outer, end);
      const [x3, y3] = polar(cx, cy, inner, end);
      const [x4, y4] = polar(cx, cy, inner, start);
      return {
        id: slice.id,
        label: slice.label,
        color: slice.color,
        value: slice.value,
        d: `M ${x1} ${y1} A ${outer} ${outer} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`,
      };
    });
}

export function buildTrendView(
  tendencia: Array<{ month: string; receita: number; despesa: number }>,
): TrendPoint[] {
  return tendencia.map((point) => ({
    month: point.month,
    label: monthShortLabel(point.month),
    receita: point.receita,
    despesa: point.despesa,
    lucro: point.receita - point.despesa,
  }));
}

export function trendMax(points: TrendPoint[]): number {
  return Math.max(1, ...points.flatMap((point) => [point.receita, point.despesa, Math.abs(point.lucro)]));
}

export function groupReceivablesByCategoria(items: FinanceReceivableItem[]): NamedCents[] {
  return toNamedCents(
    groupCentsByKey(items, (item) => item.categoria, (item) => Number(item.valor_cents)),
    categoriaLabel,
  );
}

export function groupExpensesByCategoria(items: FinanceCustoTitulo[]): NamedCents[] {
  return toNamedCents(
    groupCentsByKey(items, (item) => item.categoria, (item) => Number(item.valor_cents)),
    categoriaLabel,
  );
}

export function topPatients(items: FinanceReceivableItem[], limit = 5): NamedCents[] {
  return toNamedCents(
    groupCentsByKey(
      items.filter((item) => item.paciente_id),
      (item) => item.paciente_id as string,
      (item) => Number(item.valor_cents),
    ).map((row) => ({
      key: row.key,
      cents: row.cents,
    })),
    (key) => items.find((item) => item.paciente_id === key)?.paciente_nome ?? 'Paciente',
    limit,
  );
}

export function contractMix(plans: FinancePatientPlanRow[]): NamedCents[] {
  const rows = groupCentsByKey(
    plans,
    (row) => {
      if (!row.plan) return 'SEM_CONTRATO';
      if (row.plan.model_type === 'CONVENIO') return 'CONVENIO';
      if (row.plan.billing_type === 'MENSAL_RECORRENTE') return 'MENSAL';
      if (row.plan.billing_type === 'PACOTE' || row.plan.modelo === 'pacote') return 'PACOTE';
      return 'AVULSO';
    },
    () => 1,
  );
  const labels: Record<string, string> = {
    MENSAL: 'Mensal recorrente',
    PACOTE: 'Pacote',
    AVULSO: 'Avulso',
    CONVENIO: 'Convênio',
    SEM_CONTRATO: 'Sem contrato',
  };
  return toNamedCents(rows, (key) => labels[key] ?? key, 8);
}

export function statusSlices(
  paid: number,
  open: number,
  overdue: number,
  labels: { paid: string; open: string; overdue: string },
): DonutSlice[] {
  return [
    { id: 'pago', label: labels.paid, value: paid, color: CHART_PALETTE.mint },
    { id: 'aberto', label: labels.open, value: open, color: CHART_PALETTE.alert },
    { id: 'atrasado', label: labels.overdue, value: overdue, color: CHART_PALETTE.error },
  ].filter((slice) => slice.value > 0);
}
