import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import { formatCurrency } from '@features/billing/format';
import type { PaymentPrompt } from './financeiro.types';
import { centsToInputReais, reaisInputToCents } from './financeiro.types';

interface SessionPaymentModalProps {
  prompt: PaymentPrompt | null;
  onClose: () => void;
  onDone: () => void;
}

export function SessionPaymentModal({ prompt, onClose, onDone }: SessionPaymentModalProps) {
  const [mode, setMode] = useState<'pacote' | 'avulso' | 'cortesia' | 'nao'>('avulso');
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState<'pix' | 'cartao' | 'dinheiro' | 'outro'>('pix');

  useEffect(() => {
    if (!prompt) return;
    setValor(centsToInputReais(prompt.valor_sugerido_cents));
    setMode(prompt.pode_consumir_pacote ? 'pacote' : 'avulso');
  }, [prompt]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!prompt) return;
      if (mode === 'pacote') {
        return callFunction('financeiro-upsert-patient-plan', {
          action: 'confirm_session_payment',
          schedule_id: prompt.schedule_id,
          payment_action: 'consumir_pacote',
        });
      }
      if (mode === 'cortesia') {
        return callFunction('financeiro-upsert-patient-plan', {
          action: 'confirm_session_payment',
          schedule_id: prompt.schedule_id,
          payment_action: 'cortesia',
        });
      }
      if (mode === 'nao') {
        return callFunction('financeiro-upsert-patient-plan', {
          action: 'confirm_session_payment',
          schedule_id: prompt.schedule_id,
          payment_action: 'nao_realizado',
        });
      }
      return callFunction('financeiro-upsert-patient-plan', {
        action: 'confirm_session_payment',
        schedule_id: prompt.schedule_id,
        payment_action: 'receber_avulso',
        valor_cents: reaisInputToCents(valor),
        forma_pagamento: forma,
      });
    },
    onSuccess: () => onDone(),
  });

  return (
    <StandardModal
      isOpen={!!prompt}
      onClose={onClose}
      title="Registrar pagamento da sessão"
      closeOnBackdropClick={false}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm text-charcoal-muted hover:bg-slate-100 md:w-auto"
          >
            Depois
          </button>
          <LoadingButton
            type="button"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
            fullWidth
            className="md:w-auto"
          >
            Confirmar
          </LoadingButton>
        </>
      }
    >
      {prompt && (
        <div className="space-y-4">
          <p className="text-sm text-charcoal-muted">
            Sessão de <strong className="text-charcoal">{prompt.patient_name}</strong>.
            {prompt.pode_consumir_pacote
              ? ` Este paciente possui ${prompt.saldo_sessoes} sessão(ões) no pacote.`
              : ` Valor sugerido: ${formatCurrency(prompt.valor_sugerido_cents)}.`}
          </p>

          <div className="flex flex-wrap gap-2">
            {prompt.pode_consumir_pacote && (
              <ModeChip active={mode === 'pacote'} onClick={() => setMode('pacote')}>
                Descontar do pacote
              </ModeChip>
            )}
            <ModeChip active={mode === 'avulso'} onClick={() => setMode('avulso')}>
              Receber avulso
            </ModeChip>
            <ModeChip active={mode === 'cortesia'} onClick={() => setMode('cortesia')}>
              Cortesia / social
            </ModeChip>
            <ModeChip active={mode === 'nao'} onClick={() => setMode('nao')}>
              Não realizada
            </ModeChip>
          </div>

          {mode === 'avulso' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-charcoal">
                Valor recebido (R$)
                <input
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label className="text-sm font-medium text-charcoal">
                Forma
                <select
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  value={forma}
                  onChange={(e) => setForma(e.target.value as typeof forma)}
                >
                  <option value="pix">PIX</option>
                  <option value="cartao">Cartão</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
            </div>
          )}

          {mutation.isError && (
            <p className="text-xs text-error" role="alert">
              {(mutation.error as Error)?.message ?? 'Falha ao registrar pagamento.'}
            </p>
          )}
        </div>
      )}
    </StandardModal>
  );
}

function ModeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'border border-slate-200 bg-white text-charcoal-muted hover:border-primary/30'
      }`}
    >
      {children}
    </button>
  );
}
