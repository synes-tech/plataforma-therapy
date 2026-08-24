import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { formatCurrency } from '@features/billing/format';
import { AvulsoSessionModal } from '@containers/financeiro/AvulsoSessionModal';
import { RecordPaymentModal } from '@containers/financeiro/RecordPaymentModal';
import { SessionPaymentModal } from '@containers/financeiro/SessionPaymentModal';
import { invalidateFinanceQueries } from '@containers/financeiro/invalidate-finance';
import type {
  FinanceReceivableItem,
  FinanceTransacao,
  PaymentPrompt,
} from '@containers/financeiro/financeiro.types';
import {
  buildPatientSessionTimeline,
  clampMonth,
  contractMonthBounds,
  currentMonthKey,
  formatHistoryDateTime,
  formatMonthLabel,
  itemsInMonth,
  shiftMonth,
  type FinanceSessionCharge,
} from './patient-session-history';

interface PatientSessionHistoryProps {
  patientId: string;
  patientName?: string;
  suggestedCents?: number;
  monthlyContract?: boolean;
  canRegister?: boolean;
  contractStartsOn?: string | null;
  durationMonths?: number | null;
  saldoSessoes?: number;
}

interface PatientFinanceHistoryResponse {
  transacoes?: FinanceTransacao[];
  cobrancas?: FinanceSessionCharge[];
}

export function PatientSessionHistory({
  patientId,
  patientName,
  suggestedCents = 0,
  monthlyContract = false,
  canRegister = true,
  contractStartsOn,
  durationMonths,
  saldoSessoes = 0,
}: PatientSessionHistoryProps) {
  const qc = useQueryClient();
  const [avulsoOpen, setAvulsoOpen] = useState(false);
  const [payItem, setPayItem] = useState<FinanceReceivableItem | null>(null);
  const [sessionPrompt, setSessionPrompt] = useState<PaymentPrompt | null>(null);
  const [month, setMonth] = useState(currentMonthKey);

  const historyQuery = useQuery({
    queryKey: ['financeiro-patient-history', patientId],
    queryFn: () =>
      callFunction<PatientFinanceHistoryResponse>('financeiro-get-patient-ledger', {
        patient_id: patientId,
      }),
  });

  const items = useMemo(
    () => buildPatientSessionTimeline(historyQuery.data?.transacoes ?? [], historyQuery.data?.cobrancas ?? []),
    [historyQuery.data],
  );
  const bounds = useMemo(
    () =>
      contractMonthBounds({
        contractStartsOn,
        durationMonths,
        itemMonths: items.map((item) => item.date.slice(0, 7)),
        currentMonth: currentMonthKey(),
      }),
    [contractStartsOn, durationMonths, items],
  );
  const selectedMonth = clampMonth(month, bounds.start, bounds.end);
  const monthItems = useMemo(() => itemsInMonth(items, selectedMonth), [items, selectedMonth]);
  const canGoPrev = selectedMonth > bounds.start;
  const canGoNext = selectedMonth < bounds.end;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-serif text-base font-medium text-charcoal">Histórico de sessões</h3>
          <p className="mt-1 text-sm text-charcoal-muted">
            Sessões do mês: o que já aconteceu e o que ainda falta receber.
          </p>
        </div>
        {canRegister && (
          <button
            type="button"
            onClick={() => setAvulsoOpen(true)}
            className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-charcoal hover:bg-slate-50"
          >
            {monthlyContract ? 'Registrar sessão extra' : 'Registrar sessão realizada'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(selectedMonth, -1))}
          disabled={!canGoPrev}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-charcoal disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Mês anterior"
        >
          <ChevronIcon direction="left" />
        </button>
        <div className="min-w-0 text-center">
          <p className="font-display text-sm font-semibold text-charcoal">{formatMonthLabel(selectedMonth)}</p>
          <p className="text-[11px] text-charcoal-muted">
            {monthItems.length === 1 ? '1 sessão neste mês' : `${monthItems.length} sessões neste mês`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(selectedMonth, 1))}
          disabled={!canGoNext}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-charcoal disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Próximo mês"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      {historyQuery.isLoading && (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {historyQuery.isError && (
        <p className="text-sm text-error">
          {(historyQuery.error as Error).message || 'Não foi possível carregar o histórico financeiro.'}
        </p>
      )}

      {!historyQuery.isLoading && !historyQuery.isError && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
          <p className="text-sm text-charcoal-muted">
            Nenhuma sessão ou fatura ainda. Registre um atendimento avulso ou aguarde a mensalidade do mês.
          </p>
        </div>
      )}

      {!historyQuery.isLoading && !historyQuery.isError && items.length > 0 && monthItems.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
          <p className="text-sm text-charcoal-muted">Nenhuma sessão neste mês. Use as setas para ver outro período do contrato.</p>
        </div>
      )}

      {monthItems.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-charcoal-muted">
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Sessão</th>
                  <th className="px-4 py-3 font-semibold">Tipo</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  <th className="px-4 py-3 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthItems.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-3 text-charcoal-muted">
                      {formatHistoryDateTime(item.date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-charcoal">{item.title}</td>
                    <td className="px-4 py-3 text-charcoal-muted">{item.kindLabel}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${item.badgeClass}`}>
                        {item.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-charcoal">
                      {item.valor_cents > 0 ? formatCurrency(item.valor_cents) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <HistoryAction
                        item={item}
                        onPay={() =>
                          setPayItem({
                            ...item.transacao!,
                            tipo: 'ENTRADA',
                            paciente_id: patientId,
                            paciente_nome: patientName ?? null,
                          })
                        }
                        onConfirm={() =>
                          item.schedule_id
                            ? setSessionPrompt({
                                schedule_id: item.schedule_id,
                                patient_id: patientId,
                                patient_name: patientName ?? 'Paciente',
                                modelo: 'avulso',
                                saldo_sessoes: saldoSessoes,
                                valor_sugerido_cents: item.valor_cents || suggestedCents,
                                pode_consumir_pacote: saldoSessoes > 0,
                              })
                            : undefined
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {monthItems.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-charcoal">{item.title}</p>
                    <p className="mt-0.5 text-xs text-charcoal-muted">
                      {formatHistoryDateTime(item.date)} · {item.kindLabel}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${item.badgeClass}`}>
                    {item.statusLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-charcoal">
                    {item.valor_cents > 0 ? formatCurrency(item.valor_cents) : '—'}
                  </p>
                  <HistoryAction
                    item={item}
                    onPay={() =>
                      setPayItem({
                        ...item.transacao!,
                        tipo: 'ENTRADA',
                        paciente_id: patientId,
                        paciente_nome: patientName ?? null,
                      })
                    }
                    onConfirm={() =>
                      item.schedule_id
                        ? setSessionPrompt({
                            schedule_id: item.schedule_id,
                            patient_id: patientId,
                            patient_name: patientName ?? 'Paciente',
                            modelo: 'avulso',
                            saldo_sessoes: saldoSessoes,
                            valor_sugerido_cents: item.valor_cents || suggestedCents,
                            pode_consumir_pacote: saldoSessoes > 0,
                          })
                        : undefined
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AvulsoSessionModal
        isOpen={avulsoOpen}
        patientId={patientId}
        patientName={patientName}
        suggestedCents={suggestedCents}
        monthlyContract={monthlyContract}
        onClose={() => setAvulsoOpen(false)}
        onDone={() => setAvulsoOpen(false)}
      />

      <RecordPaymentModal item={payItem} onClose={() => setPayItem(null)} onDone={() => setPayItem(null)} />

      <SessionPaymentModal
        prompt={sessionPrompt}
        onClose={() => setSessionPrompt(null)}
        onDone={() => {
          setSessionPrompt(null);
          invalidateFinanceQueries(qc);
        }}
      />
    </section>
  );
}

function HistoryAction({
  item,
  onPay,
  onConfirm,
}: {
  item: { payable: boolean; transacao?: unknown; confirmable?: boolean; schedule_id?: string | null };
  onPay: () => void;
  onConfirm: () => void;
}) {
  if (item.payable && item.transacao) {
    return (
      <button
        type="button"
        onClick={onPay}
        className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-white"
      >
        Confirmar pagamento
      </button>
    );
  }
  if (item.confirmable && item.schedule_id) {
    return (
      <button
        type="button"
        onClick={onConfirm}
        className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-white"
      >
        Confirmar sessão
      </button>
    );
  }
  return <span className="text-xs text-charcoal-muted">—</span>;
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
      />
    </svg>
  );
}
