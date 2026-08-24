import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import { Toast } from '@containers/patient/Toast';
import { formatCurrency } from '@features/billing/format';
import { invalidateFinanceQueries } from './invalidate-finance';
import { MODELO_LABEL, type PendingSessionItem, type PaymentPrompt } from './financeiro.types';

interface SessionsToClassifyTabProps {
  items: PendingSessionItem[];
  loading?: boolean;
  onConfirmSession: (prompt: PaymentPrompt) => void;
}

export function SessionsToClassifyTab({ items, loading, onConfirmSession }: SessionsToClassifyTabProps) {
  const qc = useQueryClient();
  const [skipItem, setSkipItem] = useState<PendingSessionItem | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const skipMutation = useMutation({
    mutationFn: (item: PendingSessionItem) =>
      callFunction('financeiro-upsert-patient-plan', {
        action: 'confirm_session_payment',
        schedule_id: item.schedule_id,
        payment_action: 'nao_realizado',
      }),
    onSuccess: () => {
      invalidateFinanceQueries(qc);
      setSkipItem(null);
      setToast({ message: 'Sessão marcada como não aconteceu.', variant: 'success' });
    },
    onError: (err) => {
      setToast({
        message: err instanceof Error ? err.message : 'Não foi possível atualizar a sessão.',
        variant: 'error',
      });
    },
  });

  return (
    <section className="space-y-4">
      <p className="text-sm text-charcoal-muted">
        O horário já passou. Diga se o atendimento aconteceu. Se aconteceu, a receita entra no mês da data que você informar.
      </p>

      {loading && (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal">{item.patient_name}</p>
                <p className="text-xs text-charcoal-muted">
                  {item.schedule?.scheduled_at
                    ? new Date(item.schedule.scheduled_at).toLocaleString('pt-BR')
                    : 'Horário não informado'}
                  {' · '}
                  {MODELO_LABEL[(item.modelo as keyof typeof MODELO_LABEL) ?? 'avulso'] ?? item.modelo}
                  {item.sessoes_disponiveis > 0 ? ` · saldo pacote: ${item.sessoes_disponiveis}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-sm font-bold tabular-nums tracking-tight text-charcoal">{formatCurrency(item.valor_previsto_cents)}</p>
                <button
                  type="button"
                  onClick={() => setSkipItem(item)}
                  className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-xs font-medium text-charcoal hover:bg-slate-50"
                >
                  Não aconteceu
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onConfirmSession({
                      schedule_id: item.schedule_id,
                      patient_id: item.patient_id,
                      patient_name: item.patient_name,
                      modelo: item.modelo,
                      saldo_sessoes: item.sessoes_disponiveis,
                      valor_sugerido_cents: item.valor_previsto_cents,
                      pode_consumir_pacote: item.sessoes_disponiveis > 0,
                    })
                  }
                  className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-xs font-medium text-white hover:bg-primary/90"
                >
                  Aconteceu
                </button>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-charcoal-muted">Nenhuma sessão pendente.</li>
          )}
        </ul>
      )}

      <StandardModal
        isOpen={Boolean(skipItem)}
        onClose={() => setSkipItem(null)}
        title="Sessão não aconteceu"
        closeOnBackdropClick={!skipMutation.isPending}
        footer={
          <>
            <button
              type="button"
              onClick={() => setSkipItem(null)}
              disabled={skipMutation.isPending}
              className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm text-charcoal-muted hover:bg-slate-100 disabled:opacity-50"
            >
              Voltar
            </button>
            <LoadingButton
              type="button"
              loading={skipMutation.isPending}
              loadingLabel="Salvando"
              onClick={() => skipItem && skipMutation.mutate(skipItem)}
            >
              Confirmar
            </LoadingButton>
          </>
        }
      >
        <p className="text-sm text-charcoal-muted">
          {skipItem ? `A sessão de ${skipItem.patient_name} sai da fila e não gera cobrança.` : ''}
        </p>
      </StandardModal>

      <Toast
        message={toast?.message ?? ''}
        visible={Boolean(toast)}
        variant={toast?.variant}
        onDismiss={() => setToast(null)}
      />
    </section>
  );
}
