import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { formatCurrency } from '@features/billing/format';
import { AvulsoSessionModal } from '@containers/financeiro/AvulsoSessionModal';
import { RecordPaymentModal } from '@containers/financeiro/RecordPaymentModal';
import type { FinanceReceivableItem, FinanceTransacao } from '@containers/financeiro/financeiro.types';
import {
  buildPatientSessionTimeline,
  formatHistoryDate,
  groupHistoryByMonth,
  type FinanceSessionCharge,
} from './patient-session-history';

interface PatientSessionHistoryProps {
  patientId: string;
  patientName?: string;
  suggestedCents?: number;
  monthlyContract?: boolean;
  canRegister?: boolean;
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
}: PatientSessionHistoryProps) {
  const [avulsoOpen, setAvulsoOpen] = useState(false);
  const [payItem, setPayItem] = useState<FinanceReceivableItem | null>(null);

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
  const groups = useMemo(() => groupHistoryByMonth(items), [items]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-serif text-base font-medium text-charcoal">Histórico de sessões</h3>
          <p className="mt-1 text-sm text-charcoal-muted">
            Linha do tempo do que foi atendido e do que ainda falta receber.
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

      {historyQuery.isLoading && (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
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

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.monthKey}>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-charcoal-muted">{group.label}</p>
            <ol className="relative space-y-3 border-l border-slate-200 pl-5">
              {group.items.map((item) => (
                <li key={item.id} className="relative">
                  <span className="absolute -left-[25px] top-3 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />
                  <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-charcoal">{item.title}</p>
                      <p className="mt-0.5 text-xs text-charcoal-muted">
                        {formatHistoryDate(item.date)}
                        {' · '}
                        {item.kindLabel}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${item.badgeClass}`}>
                        {item.statusLabel}
                      </span>
                      {item.valor_cents > 0 && (
                        <p className="text-sm font-medium text-charcoal">{formatCurrency(item.valor_cents)}</p>
                      )}
                      {item.payable && item.transacao && (
                        <button
                          type="button"
                          onClick={() =>
                            setPayItem({
                              ...item.transacao!,
                              tipo: 'ENTRADA',
                              paciente_id: patientId,
                              paciente_nome: patientName ?? null,
                            })
                          }
                          className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Confirmar pagamento
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

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
    </section>
  );
}
