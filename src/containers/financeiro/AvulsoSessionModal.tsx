import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import { Toast } from '@containers/patient/Toast';
import { centsToInputReais, reaisInputToCents } from './financeiro.types';
import { invalidateFinanceQueries } from './invalidate-finance';

interface AvulsoSessionModalProps {
  isOpen: boolean;
  patientId: string;
  patientName?: string;
  suggestedCents?: number;
  monthlyContract?: boolean;
  onClose: () => void;
  onDone: () => void;
}

function localDateTimeValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AvulsoSessionModal({
  isOpen,
  patientId,
  patientName,
  suggestedCents = 0,
  monthlyContract = false,
  onClose,
  onDone,
}: AvulsoSessionModalProps) {
  const qc = useQueryClient();
  const [valor, setValor] = useState(centsToInputReais(suggestedCents));
  const [occurredAt, setOccurredAt] = useState(localDateTimeValue);
  const [alreadyPaid, setAlreadyPaid] = useState(true);
  const [forma, setForma] = useState<'pix' | 'cartao' | 'dinheiro' | 'outro'>('pix');
  const [descricao, setDescricao] = useState('');
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValor(centsToInputReais(suggestedCents));
    setOccurredAt(localDateTimeValue());
    setAlreadyPaid(true);
    setForma('pix');
    setDescricao(monthlyContract ? 'Sessão extra' : 'Sessão avulsa');
  }, [isOpen, suggestedCents, monthlyContract]);

  const mutation = useMutation({
    mutationFn: () =>
      callFunction('financeiro-upsert-transacao', {
        action: 'registrar_sessao_avulsa',
        patient_id: patientId,
        valor_cents: reaisInputToCents(valor),
        is_already_paid: alreadyPaid,
        descricao: descricao.trim() || null,
        occurred_at: new Date(occurredAt).toISOString(),
        forma_pagamento: alreadyPaid ? forma : undefined,
      }),
    onSuccess: () => {
      invalidateFinanceQueries(qc);
      setToast({
        message: alreadyPaid ? 'Sessão registrada e baixada.' : 'Sessão lançada a receber.',
        variant: 'success',
      });
      onDone();
    },
  });

  return (
    <>
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={monthlyContract ? 'Registrar sessão extra' : 'Registrar sessão avulsa'}
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
            disabled={reaisInputToCents(valor) < 0 || !patientId}
            onClick={() => mutation.mutate()}
          >
            {alreadyPaid ? 'Registrar e dar baixa' : 'Lançar a receber'}
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-charcoal-muted">
          {patientName ? (
            <>
              Atendimento pontual de <strong className="font-medium text-charcoal">{patientName}</strong>.
            </>
          ) : (
            'Atendimento pontual fora da série recorrente.'
          )}{' '}
          {monthlyContract
            ? 'Entra no histórico clínico e gera um título separado da mensalidade.'
            : 'Gera o título no caixa e registra a sessão no histórico.'}
        </p>
        <label className="block text-xs font-medium text-charcoal-muted">
          Valor (R$)
          <input
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="block text-xs font-medium text-charcoal-muted">
          Quando aconteceu
          <input
            type="datetime-local"
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setAlreadyPaid(true)}
            className={`rounded-xl border px-3 py-3 text-left ${
              alreadyPaid
                ? 'border-primary bg-primary-50 ring-1 ring-primary/25'
                : 'border-slate-200 bg-white hover:border-primary/30'
            }`}
          >
            <span className="block text-sm font-medium text-charcoal">Já foi paga</span>
            <span className="mt-0.5 block text-[11px] text-charcoal-muted">Registra a sessão e dá baixa agora</span>
          </button>
          <button
            type="button"
            onClick={() => setAlreadyPaid(false)}
            className={`rounded-xl border px-3 py-3 text-left ${
              !alreadyPaid
                ? 'border-primary bg-primary-50 ring-1 ring-primary/25'
                : 'border-slate-200 bg-white hover:border-primary/30'
            }`}
          >
            <span className="block text-sm font-medium text-charcoal">A cobrar</span>
            <span className="mt-0.5 block text-[11px] text-charcoal-muted">Entra no caixa como a receber</span>
          </button>
        </div>
        {alreadyPaid && (
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['pix', 'PIX'],
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
        )}
        <label className="block text-xs font-medium text-charcoal-muted">
          Descrição
          <input
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </label>
        {mutation.isError && (
          <p className="text-xs text-error">{(mutation.error as Error).message}</p>
        )}
      </div>
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
