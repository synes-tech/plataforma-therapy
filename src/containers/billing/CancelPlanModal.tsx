import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StandardModal } from '@shared/ui/StandardModal';
import { TheryAvatar } from '@shared/ui/TheryAvatar';
import { LoadingButton, PageLoader } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { formatBRL } from '@shared/lib/therapist-plans';

interface CancelPreview {
  action: 'preview';
  plan_id: string;
  plan_name: string;
  billing_cycle: 'monthly' | 'yearly';
  in_trial: boolean;
  effective_at: string;
  cancels_immediately: boolean;
  yearly_commitment_active: boolean;
  commitment_ends_at: string | null;
  fidelity_adjustment_cents: number;
  fidelity_months_used: number;
  requires_fidelity_acceptance: boolean;
  billing_exempt?: boolean;
  has_stripe_subscription?: boolean;
}

interface CancelResult {
  action: 'confirm';
  canceled: true;
  cancels_immediately: boolean;
  effective_at: string;
  payment_methods_detached: number;
  fidelity_adjustment_cents: number;
  message: string;
}

interface CancelPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CancelPlanModal({ isOpen, onClose }: CancelPlanModalProps) {
  const queryClient = useQueryClient();
  const [acceptFidelity, setAcceptFidelity] = useState(false);
  const [result, setResult] = useState<CancelResult | null>(null);

  const { data: preview, isLoading, error, refetch } = useQuery({
    queryKey: ['cancel-subscription-preview'],
    queryFn: () => callFunction<CancelPreview>('cancel-subscription', { action: 'preview' }),
    enabled: isOpen && !result,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () =>
      callFunction<CancelResult>('cancel-subscription', {
        action: 'confirm',
        accept_fidelity_adjustment: acceptFidelity,
      }),
    onSuccess: (res) => {
      setResult(res);
      void queryClient.invalidateQueries({ queryKey: ['plan-control-state'] });
      void queryClient.invalidateQueries({ queryKey: ['clinic-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['paywall-state'] });
    },
  });

  const handleClose = () => {
    setAcceptFidelity(false);
    setResult(null);
    mutation.reset();
    onClose();
  };

  const courtesyAccount = Boolean(preview?.billing_exempt) && !preview?.has_stripe_subscription;

  const confirmDisabled =
    courtesyAccount || (Boolean(preview?.requires_fidelity_acceptance) && !acceptFidelity);

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Tem certeza de que deseja cancelar a assinatura?"
      size="lg"
      footer={
        result || courtesyAccount ? (
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-charcoal px-5 text-sm font-semibold text-white transition-colors hover:bg-charcoal-light md:w-auto"
          >
            Entendi
          </button>
        ) : error || !preview ? (
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 md:w-auto"
          >
            Fechar
          </button>
        ) : (
          <div className="flex w-full flex-col gap-2 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={mutation.isPending}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50"
            >
              Manter meu plano
            </button>
            <LoadingButton
              type="button"
              variant="danger"
              loading={mutation.isPending}
              disabled={confirmDisabled || isLoading}
              onClick={() => mutation.mutate()}
              className="font-semibold"
            >
              Confirmar cancelamento
            </LoadingButton>
          </div>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-mint-100 bg-mint-50 px-4 py-3 text-sm text-mint-dark">
            {result.message}
          </div>
          <ul className="space-y-2 text-sm text-charcoal-muted">
            <li>
              • Método de pagamento removido: {result.payment_methods_detached} cartão(ões) desanexado(s) —
              nenhuma cobrança futura ocorrerá.
            </li>
            <li>
              • {result.cancels_immediately
                ? 'Sua conta já está no plano Free.'
                : `Acesso mantido até ${new Date(result.effective_at).toLocaleDateString('pt-BR')}; depois sua conta passa para o plano Free.`}
            </li>
            <li>• Seus dados clínicos permanecem preservados.</li>
            <li>• Enviamos um e-mail de confirmação com todos os detalhes.</li>
          </ul>
        </div>
      ) : isLoading ? (
        <PageLoader label="Calculando efeitos do cancelamento..." className="min-h-[20vh]" />
      ) : error || !preview ? (
        <div className="space-y-3">
          <div role="alert" className="rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
            {(error as Error | undefined)?.message ??
              'Não foi possível carregar os detalhes do cancelamento. Tente novamente.'}
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-charcoal hover:bg-slate-50"
          >
            Tentar novamente
          </button>
        </div>
      ) : courtesyAccount ? (
        <div className="space-y-4">
          <div className="flex justify-center">
            <TheryAvatar pose="sad" size="lg" variant="figure" decorative />
          </div>
          <p className="text-sm leading-relaxed text-charcoal">
            Esta é uma conta administrativa, sem cobrança Stripe. Não há assinatura nem cartão para
            cancelar — o acesso de cortesia continua.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center">
            <TheryAvatar pose="sad" size="lg" variant="figure" decorative />
          </div>
          <p className="text-sm leading-relaxed text-charcoal">
            Você está cancelando o <strong>{preview.plan_name}</strong>
            {preview.billing_cycle === 'yearly' ? ' (ciclo anual)' : ' (ciclo mensal)'}. Ao confirmar:
          </p>

          <ul className="space-y-2 text-sm text-charcoal-muted">
            {preview.in_trial ? (
              <li>
                • Você está no período gratuito: o cancelamento é <strong>imediato</strong> e{' '}
                <strong>nenhuma cobrança será feita</strong>.
              </li>
            ) : preview.cancels_immediately ? (
              <li>• O cancelamento é imediato.</li>
            ) : (
              <li>
                • Você mantém o acesso até{' '}
                <strong>{new Date(preview.effective_at).toLocaleDateString('pt-BR')}</strong> (período já
                pago). Depois disso, sua conta passa para o plano Free.
              </li>
            )}
            <li>
              • Seu cartão será <strong>removido da plataforma</strong> — nenhuma cobrança futura poderá
              ocorrer.
            </li>
            <li>• Seus dados clínicos permanecem preservados no plano Free (1 paciente ativo).</li>
          </ul>

          {preview.requires_fidelity_acceptance && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Acerto de fidelidade do plano anual
              </p>
              <p className="text-sm leading-relaxed text-amber-800">
                Seu plano anual tem 12% de desconto com compromisso de 12 meses
                {preview.commitment_ends_at
                  ? ` (até ${new Date(preview.commitment_ends_at).toLocaleDateString('pt-BR')})`
                  : ''}
                . Ao cancelar agora, os <strong>{preview.fidelity_months_used} meses já utilizados</strong>{' '}
                são recalculados ao preço mensal cheio. Valor do acerto:{' '}
                <strong>{formatBRL(preview.fidelity_adjustment_cents)}</strong>, cobrado no cartão antes da
                remoção.
              </p>
              <label className="flex items-start gap-2 text-sm text-amber-900">
                <input
                  type="checkbox"
                  checked={acceptFidelity}
                  onChange={(e) => setAcceptFidelity(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-amber-300"
                />
                <span>
                  Estou ciente e aceito o acerto de fidelidade de{' '}
                  {formatBRL(preview.fidelity_adjustment_cents)}.
                </span>
              </label>
            </div>
          )}

          {mutation.isError && (
            <div role="alert" className="rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
              {(mutation.error as Error).message}
            </div>
          )}
        </div>
      )}
    </StandardModal>
  );
}
