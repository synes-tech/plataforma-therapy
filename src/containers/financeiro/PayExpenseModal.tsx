import { useEffect, useState } from 'react';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import { formatCurrency } from '@features/billing/format';
import { Toast } from '@containers/patient/Toast';
import type { FinanceCustoTitulo } from './financeiro.types';
import { installmentProgress } from './expenses.utils';
import { usePayExpense } from './usePayExpense';

interface PayExpenseModalProps {
  item: FinanceCustoTitulo | null;
  onClose: () => void;
  onDone: () => void;
}

export function PayExpenseModal({ item, onClose, onDone }: PayExpenseModalProps) {
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState<'pix' | 'cartao' | 'dinheiro' | 'boleto' | 'outro'>('pix');
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const mutation = usePayExpense();
  const parcela = item ? installmentProgress(item) : null;

  useEffect(() => {
    if (!item) return;
    setPaidOn(new Date().toISOString().slice(0, 10));
    setForma('pix');
  }, [item]);

  return (
    <>
      <StandardModal
        isOpen={Boolean(item)}
        onClose={onClose}
        title="Confirmar pagamento"
        closeOnBackdropClick={!mutation.isPending}
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm text-charcoal-muted hover:bg-slate-100"
            >
              Cancelar
            </button>
            <LoadingButton
              type="button"
              loading={mutation.isPending}
              loadingLabel="Confirmando"
              onClick={() => {
                if (!item) return;
                mutation.mutate(
                  { item, paidOn, forma },
                  {
                    onSuccess: () => {
                      setToast({ message: 'Despesa baixada.', variant: 'success' });
                      onDone();
                    },
                    onError: (err) => {
                      setToast({
                        message: err instanceof Error ? err.message : 'Não foi possível dar baixa.',
                        variant: 'error',
                      });
                    },
                  },
                );
              }}
            >
              Confirmar pagamento
            </LoadingButton>
          </>
        }
      >
        {item && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-[#F8FAF9] px-4 py-3">
              <p className="text-sm font-medium text-charcoal">{item.descricao}</p>
              <p className="mt-1 font-serif text-xl text-charcoal">{formatCurrency(item.valor_cents)}</p>
              {parcela && <p className="mt-1 text-xs text-charcoal-muted">{parcela.label}</p>}
            </div>
            <label className="block text-xs font-medium text-charcoal-muted">
              Data do pagamento
              <input
                type="date"
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['pix', 'PIX'],
                  ['boleto', 'Boleto'],
                  ['cartao', 'Cartão'],
                  ['dinheiro', 'Dinheiro'],
                  ['outro', 'Outro'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForma(value)}
                  className={`h-9 rounded-xl px-3 text-xs font-medium ${
                    forma === value
                      ? 'bg-primary text-white'
                      : 'border border-slate-200 bg-white text-charcoal hover:border-primary/30'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {mutation.isError && (
              <p className="text-xs text-error">{(mutation.error as Error).message}</p>
            )}
          </div>
        )}
      </StandardModal>
      <Toast
        message={toast?.message ?? ''}
        visible={Boolean(toast)}
        variant={toast?.variant}
        onDismiss={() => setToast(null)}
      />
    </>
  );
}
