import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { formatCurrency } from '@features/billing/format';
import { canAccessFinance } from '@shared/lib/roles';
import { useAuth } from '@shared/hooks/useAuth';
import {
  BILLING_TYPE_LABEL,
  MODEL_TYPE_LABEL,
  type FinanceBillingType,
  type FinanceModelType,
  type FinanceStatus,
} from '@containers/financeiro/financeiro.types';
import { RecurrenceWindowsModal } from './RecurrenceWindowsModal';
import { weekdayLabel, normalizeWindowTime } from './recurrence-windows';
import type { FinanceContractWindow } from '@containers/financeiro/financeiro.types';
import { PatientFinancialSetupModal } from './PatientFinancialSetupModal';
import { PatientSessionHistory } from './PatientSessionHistory';

interface PatientFinanceTabProps {
  patientId: string;
}

export function PatientFinanceTab({ patientId }: PatientFinanceTabProps) {
  const { user } = useAuth();
  const allowed = canAccessFinance(user);
  const [needsWindows, setNeedsWindows] = useState(false);
  const [windowsOpen, setWindowsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  const ledgerQuery = useQuery({
    queryKey: ['financeiro-ledger', patientId],
    queryFn: () =>
      callFunction<{
        contract: {
          model_type?: FinanceModelType;
          billing_type?: FinanceBillingType;
          modelo?: string;
          valor_acordado_cents?: number;
          valor_sessao_cents: number;
          due_day?: number | null;
          sessions_per_month?: number | null;
          sessions_custom?: boolean;
          contract_duration_months?: number | null;
          pacote_qtd_sessoes: number | null;
          pacote_valor_cents: number | null;
          observacoes: string | null;
        } | null;
        needs_windows?: boolean;
        next_step?: string | null;
        janelas?: FinanceContractWindow[];
        patient?: { name?: string };
        sessoes_disponiveis?: number;
        transacoes?: Array<{
          id: string;
          tipo: string;
          categoria: string;
          descricao: string;
          valor_cents: number;
          status: FinanceStatus;
          data_pagamento: string | null;
          created_at: string;
        }>;
      }>('financeiro-upsert-patient-plan', { action: 'get_contract', patient_id: patientId }),
    enabled: allowed,
  });

  useEffect(() => {
    setNeedsWindows(Boolean(ledgerQuery.data?.needs_windows));
  }, [ledgerQuery.data]);

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-8 text-center text-sm text-charcoal-muted">
        O módulo financeiro está disponível para o responsável do consultório.
      </div>
    );
  }

  const saldo = ledgerQuery.data?.sessoes_disponiveis ?? 0;
  const contract = ledgerQuery.data?.contract;
  const janelas = ledgerQuery.data?.janelas ?? [];
  const patientName = ledgerQuery.data?.patient?.name;

  return (
    <div className="space-y-5">
      {needsWindows && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Contrato mensal salvo. Defina os horários fixos (ex.: toda sexta às 10h) para popular a
            agenda e gerar a fatura do mês.
          </p>
          <button
            type="button"
            onClick={() => setWindowsOpen(true)}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-xs font-medium text-white hover:bg-primary-dark"
          >
            Definir horários
          </button>
        </div>
      )}

      {ledgerQuery.isLoading && (
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" aria-hidden />
      )}

      {!ledgerQuery.isLoading && !contract && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center">
          <p className="font-serif text-lg text-charcoal">Sem contrato financeiro</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-charcoal-muted">
            Defina particular ou convênio e como o paciente será cobrado. Sem isso, o caixa e a
            agenda recorrente ficam incompletos.
          </p>
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Definir contrato
          </button>
        </div>
      )}

      {contract && (
        <div className="rounded-2xl border border-primary/15 bg-primary-50/50 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Contrato atual</p>
              <p className="mt-1 font-serif text-lg text-charcoal">
                {MODEL_TYPE_LABEL[contract.model_type ?? 'PARTICULAR']} ·{' '}
                {BILLING_TYPE_LABEL[contract.billing_type ?? 'AVULSO']}
              </p>
              <p className="mt-1 text-xs text-charcoal-muted">
                {formatCurrency(contract.valor_acordado_cents ?? contract.valor_sessao_cents)}
                {contract.billing_type === 'MENSAL_RECORRENTE' && contract.due_day
                  ? ` · vence dia ${contract.due_day}`
                  : ''}
                {contract.sessions_per_month ? ` · ${contract.sessions_per_month} sessões/mês` : ''}
                {saldo > 0 ? ` · saldo de pacote: ${saldo} sessão(ões)` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-medium text-charcoal hover:bg-slate-50"
            >
              Editar contrato
            </button>
          </div>
          {janelas.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {janelas.map((janela) => (
                <span
                  key={janela.id}
                  className="rounded-full bg-white px-2.5 py-1 text-[11px] text-charcoal"
                >
                  {weekdayLabel(janela.weekday, 'short')} {normalizeWindowTime(janela.start_time)}
                </span>
              ))}
              <button
                type="button"
                onClick={() => setWindowsOpen(true)}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Alterar horários
              </button>
            </div>
          )}
        </div>
      )}

      <PatientSessionHistory
        patientId={patientId}
        patientName={patientName}
        suggestedCents={contract?.valor_sessao_cents ?? contract?.valor_acordado_cents ?? 0}
        monthlyContract={contract?.billing_type === 'MENSAL_RECORRENTE'}
        canRegister={Boolean(contract)}
      />

      <PatientFinancialSetupModal
        isOpen={setupOpen}
        patientId={patientId}
        patientName={patientName}
        onClose={() => setSetupOpen(false)}
        onSaved={({ needs_windows }) => {
          if (needs_windows) setNeedsWindows(true);
        }}
      />

      <RecurrenceWindowsModal
        isOpen={windowsOpen}
        patientId={patientId}
        patientName={patientName}
        onClose={() => setWindowsOpen(false)}
        onSaved={() => setNeedsWindows(false)}
      />

    </div>
  );
}
