import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import { Toast } from '@containers/patient/Toast';
import { invalidateFinanceQueries } from './invalidate-finance';
import type { FinancePatientPlanRow } from './financeiro.types';
import {
  EMPTY_INCOME_FORM,
  incomeFormToPayload,
  validateIncomeForm,
  type IncomeFormValues,
} from './income-form.schema';

interface IncomeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IncomeFormModal({ isOpen, onClose }: IncomeFormModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<IncomeFormValues>(EMPTY_INCOME_FORM);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const plansQuery = useQuery({
    queryKey: ['financeiro-plans'],
    queryFn: () => callFunction<{ items: FinancePatientPlanRow[] }>('financeiro-list-patient-plans', {}),
    enabled: isOpen,
  });

  useEffect(() => {
    if (!isOpen) return;
    setForm({ ...EMPTY_INCOME_FORM, data_vencimento: new Date().toISOString().slice(0, 10) });
    setDirty(false);
    setErrors({});
  }, [isOpen]);

  function patch(next: Partial<IncomeFormValues>) {
    const merged = { ...form, ...next };
    setDirty(true);
    setErrors(validateIncomeForm(merged).errors);
    setForm(merged);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const result = validateIncomeForm(form);
      setDirty(true);
      setErrors(result.errors);
      if (!result.valid) throw new Error('Revise os campos da receita.');
      return callFunction('financeiro-upsert-transacao', incomeFormToPayload(form));
    },
    onSuccess: () => {
      invalidateFinanceQueries(qc);
      setToast({
        message: form.is_already_paid ? 'Receita lançada e baixada.' : 'Receita lançada a receber.',
        variant: 'success',
      });
      onClose();
    },
    onError: (err) => {
      setToast({
        message: err instanceof Error ? err.message : 'Não foi possível salvar a receita.',
        variant: 'error',
      });
    },
  });

  return (
    <>
      <StandardModal
        isOpen={isOpen}
        onClose={onClose}
        title="Nova receita"
        size="lg"
        closeOnBackdropClick={!saveMutation.isPending}
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={saveMutation.isPending}
              className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm text-charcoal-muted hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <LoadingButton
              type="button"
              loading={saveMutation.isPending}
              loadingLabel="Salvando"
              onClick={() => saveMutation.mutate()}
            >
              Salvar
            </LoadingButton>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal-muted">
            Lançamento avulso no caixa. Paciente é opcional — use para palestra, supervisão ou outro rendimento.
          </p>

          <label className="block text-xs font-medium text-charcoal-muted">
            Descrição *
            <input
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              value={form.descricao}
              onChange={(e) => patch({ descricao: e.target.value })}
              placeholder="Ex.: Supervisão, palestra, material"
            />
            {dirty && errors.descricao && (
              <p className="mt-1 text-xs text-error" role="alert">{errors.descricao}</p>
            )}
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-charcoal-muted">
              Valor (R$) *
              <input
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                value={form.valor}
                onChange={(e) => patch({ valor: e.target.value })}
                placeholder="350,00"
                inputMode="decimal"
              />
              {dirty && errors.valor && (
                <p className="mt-1 text-xs text-error" role="alert">{errors.valor}</p>
              )}
            </label>
            <label className="block text-xs font-medium text-charcoal-muted">
              Vencimento
              <input
                type="date"
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                value={form.data_vencimento}
                onChange={(e) => patch({ data_vencimento: e.target.value })}
              />
            </label>
          </div>

          <label className="block text-xs font-medium text-charcoal-muted">
            Categoria
            <select
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal"
              value={form.categoria}
              onChange={(e) => patch({ categoria: e.target.value as IncomeFormValues['categoria'] })}
            >
              <option value="RENDIMENTO_EXTRA">Rendimento extra</option>
              <option value="OUTROS">Outros</option>
            </select>
          </label>

          <label className="block text-xs font-medium text-charcoal-muted">
            Paciente (opcional)
            <select
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal"
              value={form.paciente_id}
              onChange={(e) => patch({ paciente_id: e.target.value })}
            >
              <option value="">Sem paciente</option>
              {(plansQuery.data?.items ?? []).map((row) => (
                <option key={row.patient_id} value={row.patient_id}>
                  {row.patient_name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-100 px-3 py-3 text-sm text-charcoal">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.is_already_paid}
              onChange={(e) => patch({ is_already_paid: e.target.checked })}
            />
            <span>
              <span className="font-medium">Já recebi</span>
              <span className="mt-0.5 block text-xs text-charcoal-muted">
                Se desmarcar, nasce como a receber na aba Receitas.
              </span>
            </span>
          </label>

          {form.is_already_paid && (
            <label className="block text-xs font-medium text-charcoal-muted">
              Forma de pagamento
              <select
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal"
                value={form.forma_pagamento}
                onChange={(e) =>
                  patch({ forma_pagamento: e.target.value as IncomeFormValues['forma_pagamento'] })
                }
              >
                <option value="pix">Pix</option>
                <option value="cartao">Cartão</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="outro">Outro</option>
              </select>
            </label>
          )}

          <label className="block text-xs font-medium text-charcoal-muted">
            Observações
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-charcoal"
              value={form.observacoes}
              onChange={(e) => patch({ observacoes: e.target.value })}
            />
          </label>
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
