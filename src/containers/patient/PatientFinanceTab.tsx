import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { formatCurrency } from '@features/billing/format';
import { LoadingButton } from '@containers/loading';
import { canAccessFinance } from '@shared/lib/roles';
import { useAuth } from '@shared/hooks/useAuth';
import {
  MODELO_LABEL,
  centsToInputReais,
  reaisInputToCents,
  type FinanceModelo,
} from '@containers/financeiro/financeiro.types';

interface PatientFinanceTabProps {
  patientId: string;
}

export function PatientFinanceTab({ patientId }: PatientFinanceTabProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const allowed = canAccessFinance(user);

  const ledgerQuery = useQuery({
    queryKey: ['financeiro-ledger', patientId],
    queryFn: () =>
      callFunction<{
        plan: {
          modelo: FinanceModelo;
          valor_sessao_cents: number;
          pacote_qtd_sessoes: number | null;
          pacote_valor_cents: number | null;
          observacoes: string | null;
        } | null;
        sessoes_disponiveis: number;
        transacoes: Array<{
          id: string;
          tipo: string;
          categoria: string;
          descricao: string;
          valor_cents: number;
          status: string;
          data_pagamento: string | null;
          created_at: string;
        }>;
        cobrancas: Array<{
          id: string;
          status_cobranca: string;
          valor_previsto_cents: number;
        }>;
      }>('financeiro-list-patient-plans', { patient_id: patientId }),
    enabled: allowed,
  });

  const [modelo, setModelo] = useState<FinanceModelo>('avulso');
  const [valorSessao, setValorSessao] = useState('150,00');
  const [pacoteQtd, setPacoteQtd] = useState('4');
  const [pacoteValor, setPacoteValor] = useState('600,00');
  const [registrarPago, setRegistrarPago] = useState(false);
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    const plan = ledgerQuery.data?.plan;
    if (!plan) return;
    setModelo(plan.modelo);
    setValorSessao(centsToInputReais(plan.valor_sessao_cents));
    if (plan.pacote_qtd_sessoes) setPacoteQtd(String(plan.pacote_qtd_sessoes));
    if (plan.pacote_valor_cents != null) setPacoteValor(centsToInputReais(plan.pacote_valor_cents));
    setObservacoes(plan.observacoes ?? '');
  }, [ledgerQuery.data?.plan]);

  const saveMutation = useMutation({
    mutationFn: () =>
      callFunction('financeiro-upsert-patient-plan', {
        patient_id: patientId,
        modelo,
        valor_sessao_cents: reaisInputToCents(valorSessao),
        pacote_qtd_sessoes: modelo === 'pacote' ? Number(pacoteQtd) || null : null,
        pacote_valor_cents: modelo === 'pacote' ? reaisInputToCents(pacoteValor) : null,
        registrar_pacote_pago: modelo === 'pacote' ? registrarPago : false,
        observacoes: observacoes || null,
      }),
    onSuccess: () => {
      setRegistrarPago(false);
      qc.invalidateQueries({ queryKey: ['financeiro-ledger', patientId] });
      qc.invalidateQueries({ queryKey: ['financeiro-plans'] });
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] });
    },
  });

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-8 text-center text-sm text-charcoal-muted">
        O módulo financeiro está disponível para o responsável do consultório.
      </div>
    );
  }

  const saldo = ledgerQuery.data?.sessoes_disponiveis ?? 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/15 bg-primary-50/50 px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Saldo de sessões</p>
        <p className="mt-1 font-serif text-2xl text-charcoal">{saldo}</p>
        <p className="mt-1 text-xs text-charcoal-muted">
          Sessões creditadas de pacotes e ainda não consumidas.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
        <h3 className="font-serif text-base font-medium text-charcoal">Acordo comercial</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['avulso', 'pacote', 'social'] as FinanceModelo[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModelo(m)}
              className={`rounded-xl border px-3 py-3 text-left text-sm ${
                modelo === m
                  ? 'border-primary bg-primary-50 text-primary'
                  : 'border-slate-200 text-charcoal-muted'
              }`}
            >
              {MODELO_LABEL[m]}
            </button>
          ))}
        </div>

        <label className="block text-sm font-medium text-charcoal">
          Valor da sessão (R$)
          <input
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
            value={valorSessao}
            onChange={(e) => setValorSessao(e.target.value)}
            inputMode="decimal"
          />
        </label>

        {modelo === 'pacote' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-charcoal">
              Qtd. de sessões
              <input
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                value={pacoteQtd}
                onChange={(e) => setPacoteQtd(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <label className="block text-sm font-medium text-charcoal">
              Valor do pacote (R$)
              <input
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
                value={pacoteValor}
                onChange={(e) => setPacoteValor(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal sm:col-span-2">
              <input
                type="checkbox"
                checked={registrarPago}
                onChange={(e) => setRegistrarPago(e.target.checked)}
                className="rounded border-slate-300 text-primary"
              />
              Registrar pacote como pago agora (credita saldo)
            </label>
          </div>
        )}

        <label className="block text-sm font-medium text-charcoal">
          Observações
          <textarea
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </label>

        <LoadingButton type="button" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          Salvar acordo
        </LoadingButton>
        {saveMutation.isError && (
          <p className="text-xs text-error">{(saveMutation.error as Error).message}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-medium text-charcoal">Histórico financeiro</h3>
        </div>
        <ul className="divide-y divide-slate-100">
          {(ledgerQuery.data?.transacoes ?? []).map((tx) => (
            <li key={tx.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-charcoal">{tx.descricao || tx.categoria}</p>
                <p className="text-xs text-charcoal-muted">
                  {tx.status}
                  {tx.data_pagamento ? ` · ${tx.data_pagamento}` : ''}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium text-charcoal">
                {formatCurrency(tx.valor_cents)}
              </p>
            </li>
          ))}
          {(ledgerQuery.data?.transacoes ?? []).length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-charcoal-muted">
              Nenhum lançamento ainda.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
