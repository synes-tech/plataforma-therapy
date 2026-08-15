import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import { Toast } from '@containers/patient/Toast';
import { formatCurrency } from '@features/billing/format';
import { EXPENSE_KIND_LABEL, reaisInputToCents, type FinanceCustoRecorrente } from './financeiro.types';
import {
  EMPTY_EXPENSE_FORM,
  expenseFormToPayload,
  validateExpenseForm,
  type ExpenseFormValues,
} from './expense-form.schema';
import { lastInstallmentLabel, previewInstallments } from './expense-preview';
import { invalidateFinanceQueries } from './invalidate-finance';

interface ExpenseFormModalProps {
  isOpen: boolean;
  value: ExpenseFormValues;
  onChange: (patch: Partial<ExpenseFormValues>) => void;
  onClose: () => void;
}

function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
        show ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0'
      }`}
      aria-hidden={!show}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

export function ExpenseFormModal({ isOpen, value, onChange, onClose }: ExpenseFormModalProps) {
  const qc = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDirty(false);
    setErrors({});
  }, [isOpen, value.id]);

  function patch(next: Partial<ExpenseFormValues>) {
    const merged = { ...value, ...next };
    const result = validateExpenseForm(merged);
    setDirty(true);
    setErrors(result.errors);
    onChange(next);
  }

  const months = Number(value.months_total) || 0;
  const parcelaCents = reaisInputToCents(value.valor);
  const totalParcelado = parcelaCents * months;
  const lastMonth =
    value.kind === 'VARIAVEL_PARCELADA' ? lastInstallmentLabel(`${value.starts_on}-01`, months) : null;
  const preview = useMemo(() => {
    if (value.kind !== 'VARIAVEL_PARCELADA') return [];
    return previewInstallments(`${value.starts_on}-01`, months, Number(value.dia_vencimento) || 10);
  }, [value.kind, value.starts_on, value.months_total, value.dia_vencimento, months]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const result = validateExpenseForm(value);
      setDirty(true);
      setErrors(result.errors);
      if (!result.valid) throw new Error('Revise os campos da despesa.');
      return callFunction('financeiro-upsert-transacao', expenseFormToPayload(value));
    },
    onSuccess: () => {
      invalidateFinanceQueries(qc);
      setToast({
        message:
          value.kind === 'VARIAVEL_PARCELADA' && !value.id
            ? `${months} parcelas geradas no caixa.`
            : 'Despesa salva.',
        variant: 'success',
      });
      setDirty(false);
      setErrors({});
      onClose();
    },
    onError: (err) => {
      setToast({
        message: err instanceof Error ? err.message : 'Não foi possível salvar a despesa.',
        variant: 'error',
      });
    },
  });

  return (
    <>
      <StandardModal
        isOpen={isOpen}
        onClose={onClose}
        title={value.id ? 'Editar despesa' : 'Nova despesa'}
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
              {value.kind === 'VARIAVEL_PARCELADA' && !value.id
                ? `Gerar ${months || 0} parcelas`
                : 'Salvar'}
            </LoadingButton>
          </>
        }
      >
        <div className="space-y-4">
          {!value.id && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(['FIXA', 'VARIAVEL_PARCELADA', 'PONTUAL'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() =>
                    patch({
                      kind,
                      categoria:
                        kind === 'FIXA' ? 'CUSTO_FIXO' : kind === 'VARIAVEL_PARCELADA' ? 'DESPESA_PARCELADA' : 'DESPESA_PONTUAL',
                    })
                  }
                  className={`rounded-xl border px-3 py-3 text-left ${
                    value.kind === kind
                      ? 'border-primary bg-primary-50 ring-1 ring-primary/25'
                      : 'border-slate-200 bg-white hover:border-primary/30'
                  }`}
                >
                  <span className="block text-sm font-medium text-charcoal">{EXPENSE_KIND_LABEL[kind]}</span>
                  <span className="mt-0.5 block text-[11px] text-charcoal-muted">
                    {kind === 'FIXA' && 'Aluguel, internet, condomínio'}
                    {kind === 'VARIAVEL_PARCELADA' && 'Cartão, empréstimo, 10x'}
                    {kind === 'PONTUAL' && 'Teste, conserto, compra única'}
                  </span>
                </button>
              ))}
            </div>
          )}

          <label className="block text-xs font-medium text-charcoal-muted">
            Descrição *
            <input
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
              value={value.descricao}
              onChange={(e) => patch({ descricao: e.target.value })}
              placeholder={
                value.kind === 'VARIAVEL_PARCELADA'
                  ? 'Ex.: Notebook em 12x'
                  : value.kind === 'PONTUAL'
                    ? 'Ex.: Teste WISC'
                    : 'Ex.: Aluguel do consultório'
              }
            />
            {dirty && errors.descricao && (
              <p className="mt-1 text-xs text-error" role="alert">{errors.descricao}</p>
            )}
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-charcoal-muted">
              {value.kind === 'VARIAVEL_PARCELADA' ? 'Valor da parcela (R$) *' : 'Valor (R$) *'}
              <input
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                value={value.valor}
                onChange={(e) => patch({ valor: e.target.value })}
                placeholder="200,00"
                inputMode="decimal"
              />
              {dirty && errors.valor && (
                <p className="mt-1 text-xs text-error" role="alert">{errors.valor}</p>
              )}
            </label>
            {value.kind !== 'PONTUAL' && (
              <label className="block text-xs font-medium text-charcoal-muted">
                Dia do vencimento (1–28)
                <input
                  type="number"
                  min={1}
                  max={28}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                  value={value.dia_vencimento}
                  onChange={(e) => patch({ dia_vencimento: e.target.value })}
                />
                {dirty && errors.dia_vencimento && (
                  <p className="mt-1 text-xs text-error" role="alert">{errors.dia_vencimento}</p>
                )}
              </label>
            )}
            {value.kind === 'PONTUAL' && (
              <label className="block text-xs font-medium text-charcoal-muted">
                Vencimento
                <input
                  type="date"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                  value={value.data_vencimento}
                  onChange={(e) => patch({ data_vencimento: e.target.value })}
                />
              </label>
            )}
          </div>

          <Reveal show={value.kind === 'VARIAVEL_PARCELADA' && !value.id}>
            <div className="space-y-3 pb-1">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-charcoal-muted">
                  Primeira parcela
                  <input
                    type="month"
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                    value={value.starts_on}
                    onChange={(e) => patch({ starts_on: e.target.value })}
                  />
                </label>
                <label className="block text-xs font-medium text-charcoal-muted">
                  Quantidade de parcelas
                  <input
                    type="number"
                    min={2}
                    max={60}
                    className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                    value={value.months_total}
                    onChange={(e) => patch({ months_total: e.target.value })}
                  />
                  {dirty && errors.months_total && (
                    <p className="mt-1 text-xs text-error" role="alert">{errors.months_total}</p>
                  )}
                </label>
              </div>
              {months > 1 && parcelaCents > 0 && (
                <div className="rounded-2xl border border-primary/15 bg-primary-50/50 px-4 py-3 text-sm text-charcoal">
                  <p className="font-medium">
                    Valor total: {formatCurrency(totalParcelado)}
                  </p>
                  <p className="mt-1 text-xs text-charcoal-muted">
                    {months}× {formatCurrency(parcelaCents)}
                    {lastMonth ? ` · última parcela em ${lastMonth}` : ''}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-charcoal-muted">
                    {preview.map((item) => (
                      <li key={item.index}>
                        Parcela {item.index} de {months} · {item.label}
                      </li>
                    ))}
                    {months > preview.length && <li>…</li>}
                  </ul>
                </div>
              )}
            </div>
          </Reveal>

          <Reveal show={value.kind === 'PONTUAL'}>
            <label className="mb-1 flex items-start gap-3 rounded-2xl border border-slate-100 px-3 py-3 text-sm text-charcoal">
              <input
                type="checkbox"
                className="mt-1"
                checked={value.is_already_paid}
                onChange={(e) => patch({ is_already_paid: e.target.checked })}
              />
              <span>
                <span className="font-medium">Já paguei</span>
                <span className="mt-0.5 block text-xs text-charcoal-muted">
                  Se desmarcar, nasce como a pagar.
                </span>
              </span>
            </label>
          </Reveal>

          {value.kind === 'FIXA' && (
            <label className="block text-xs font-medium text-charcoal-muted">
              Categoria
              <select
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal"
                value={value.categoria}
                onChange={(e) =>
                  patch({ categoria: e.target.value as FinanceCustoRecorrente['categoria'] })
                }
              >
                <option value="CUSTO_FIXO">Custo fixo</option>
                <option value="IMPOSTO">Imposto</option>
                <option value="OUTROS">Outros</option>
              </select>
            </label>
          )}

          <label className="block text-xs font-medium text-charcoal-muted">
            Observações
            <textarea
              className="mt-1 min-h-[72px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-charcoal"
              value={value.observacoes}
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

export { EMPTY_EXPENSE_FORM };
