import type { ReactNode } from 'react';
import type { FinanceBillingType, FinanceModelType } from '@containers/financeiro/financeiro.types';
import { BILLING_TYPE_LABEL, MODEL_TYPE_LABEL } from '@containers/financeiro/financeiro.types';
import { contractSummary } from './patient-contract.schema';

const inputClass =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10';

export interface PatientContractFormValues {
  model_type: FinanceModelType | '';
  billing_type: FinanceBillingType | '';
  valor: string;
  due_day: string;
  sessions_per_month: string;
  sessions_custom: boolean;
  duration_months: string;
  pacote_qtd: string;
  pacote_valor: string;
  registrar_pacote_pago: boolean;
  observacoes: string;
}

export const EMPTY_CONTRACT_FORM: PatientContractFormValues = {
  model_type: '',
  billing_type: '',
  valor: '150,00',
  due_day: '10',
  sessions_per_month: '4',
  sessions_custom: false,
  duration_months: '',
  pacote_qtd: '4',
  pacote_valor: '600,00',
  registrar_pacote_pago: false,
  observacoes: '',
};

interface PatientContractFieldsProps {
  value: PatientContractFormValues;
  onChange: (patch: Partial<PatientContractFormValues>) => void;
  errors?: Record<string, string>;
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

function ChoiceCard({
  selected,
  label,
  hint,
  onClick,
}: {
  selected: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary-50 ring-1 ring-primary/25'
          : 'border-slate-200 bg-white hover:border-primary/30'
      }`}
    >
      <span className="block text-sm font-medium text-charcoal">{label}</span>
      <span className="mt-0.5 block text-[11px] text-charcoal-muted">{hint}</span>
    </button>
  );
}

export function PatientContractFields({ value, onChange, errors = {} }: PatientContractFieldsProps) {
  const monthly = value.billing_type === 'MENSAL_RECORRENTE';
  const pacote = value.billing_type === 'PACOTE';

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-charcoal">Quem paga *</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ChoiceCard
            selected={value.model_type === 'PARTICULAR'}
            label={MODEL_TYPE_LABEL.PARTICULAR}
            hint="Família paga direto ao consultório"
            onClick={() => onChange({ model_type: 'PARTICULAR' })}
          />
          <ChoiceCard
            selected={value.model_type === 'CONVENIO'}
            label={MODEL_TYPE_LABEL.CONVENIO}
            hint="Plano de saúde ou convênio"
            onClick={() => onChange({ model_type: 'CONVENIO' })}
          />
        </div>
        {errors.model_type && <p className="text-xs text-error" role="alert">{errors.model_type}</p>}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-charcoal">Como cobra *</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ChoiceCard
            selected={value.billing_type === 'AVULSO'}
            label={BILLING_TYPE_LABEL.AVULSO}
            hint="Paga por sessão realizada"
            onClick={() => onChange({ billing_type: 'AVULSO' })}
          />
          <ChoiceCard
            selected={monthly}
            label="Mensal"
            hint="Uma fatura por mês, agenda recorrente"
            onClick={() => onChange({ billing_type: 'MENSAL_RECORRENTE' })}
          />
          <ChoiceCard
            selected={pacote}
            label={BILLING_TYPE_LABEL.PACOTE}
            hint="Crédito antecipado de sessões"
            onClick={() => onChange({ billing_type: 'PACOTE' })}
          />
        </div>
        {errors.billing_type && <p className="text-xs text-error" role="alert">{errors.billing_type}</p>}
      </fieldset>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-charcoal">
          {monthly ? 'Valor mensal acordado (R$) *' : pacote ? 'Valor de referência da sessão (R$)' : 'Valor da sessão (R$) *'}
        </label>
        <input
          className={inputClass}
          value={value.valor}
          onChange={(e) => onChange({ valor: e.target.value })}
          placeholder="150,00"
          inputMode="decimal"
        />
        {errors.valor && <p className="mt-1 text-xs text-error" role="alert">{errors.valor}</p>}
      </div>

      <Reveal show={monthly}>
        <div className="space-y-3 pb-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-charcoal">
                Sessões por mês {value.sessions_custom ? '' : '*'}
              </label>
              <input
                className={inputClass}
                value={value.sessions_per_month}
                onChange={(e) => onChange({ sessions_per_month: e.target.value })}
                inputMode="numeric"
                disabled={value.sessions_custom}
              />
              {errors.sessions_per_month && (
                <p className="mt-1 text-xs text-error" role="alert">{errors.sessions_per_month}</p>
              )}
              <label className="mt-2 flex items-center gap-2 text-xs text-charcoal-muted">
                <input
                  type="checkbox"
                  checked={value.sessions_custom}
                  onChange={(e) => onChange({ sessions_custom: e.target.checked })}
                  className="rounded border-slate-300 text-primary"
                />
                Quantidade personalizada / variável
              </label>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-charcoal">Vencimento (dia 1–28) *</label>
              <input
                className={inputClass}
                value={value.due_day}
                onChange={(e) => onChange({ due_day: e.target.value })}
                inputMode="numeric"
              />
              {errors.due_day && <p className="mt-1 text-xs text-error" role="alert">{errors.due_day}</p>}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-charcoal">Prazo do contrato (meses)</label>
            <input
              className={inputClass}
              value={value.duration_months}
              onChange={(e) => onChange({ duration_months: e.target.value })}
              placeholder="Vazio = sem prazo definido"
              inputMode="numeric"
            />
            <p className="mt-1 text-[11px] text-charcoal-muted">
              Sem prazo, a agenda e as faturas seguem em janela rolante. Ao salvar, o próximo passo pede os
              horários fixos (ex.: toda sexta às 10h).
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal show={pacote}>
        <div className="space-y-3 rounded-xl border border-slate-100 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-charcoal">Quantidade de sessões *</label>
              <input
                className={inputClass}
                value={value.pacote_qtd}
                onChange={(e) => onChange({ pacote_qtd: e.target.value })}
                inputMode="numeric"
              />
              {errors.pacote_qtd && <p className="mt-1 text-xs text-error" role="alert">{errors.pacote_qtd}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-charcoal">Valor do pacote (R$) *</label>
              <input
                className={inputClass}
                value={value.pacote_valor}
                onChange={(e) => onChange({ pacote_valor: e.target.value })}
                inputMode="decimal"
              />
              {errors.pacote_valor && <p className="mt-1 text-xs text-error" role="alert">{errors.pacote_valor}</p>}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={value.registrar_pacote_pago}
              onChange={(e) => onChange({ registrar_pacote_pago: e.target.checked })}
              className="rounded border-slate-300 text-primary"
            />
            Pacote já pago — creditar saldo agora
          </label>
        </div>
      </Reveal>

      {contractSummary(value) && (
        <div className="rounded-2xl border border-primary/15 bg-primary-50/50 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Resumo</p>
          <p className="mt-1 text-sm text-charcoal">{contractSummary(value)}</p>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-charcoal">Observações (opcional)</label>
        <textarea
          className="min-h-[72px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          rows={2}
          value={value.observacoes}
          onChange={(e) => onChange({ observacoes: e.target.value })}
          placeholder="Ex.: reajuste em 90 dias, desconto familiar..."
        />
      </div>
    </div>
  );
}
