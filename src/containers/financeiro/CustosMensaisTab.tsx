import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { formatCurrency } from '@features/billing/format';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import type { FinanceCustoRecorrente, FinanceCustosResponse, FinanceCustoTitulo } from './financeiro.types';
import { centsToInputReais, reaisInputToCents } from './financeiro.types';

const STATUS_META: Record<string, { label: string; className: string }> = {
  PENDENTE: { label: 'Pendente', className: 'bg-amber-50 text-amber-800' },
  ATRASADO: { label: 'Atrasado', className: 'bg-red-50 text-red-700' },
  PAGO: { label: 'Pago', className: 'bg-emerald-50 text-emerald-700' },
  CANCELADO: { label: 'Cancelado', className: 'bg-slate-100 text-slate-500' },
};

const emptyForm = {
  id: undefined as string | undefined,
  descricao: '',
  valor: '',
  dia_vencimento: '10',
  categoria: 'CUSTO_FIXO' as 'CUSTO_FIXO' | 'IMPOSTO' | 'OUTROS',
  observacoes: '',
};

interface CustosMensaisTabProps {
  month: string;
}

export function CustosMensaisTab({ month }: CustosMensaisTabProps) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const custosQuery = useQuery({
    queryKey: ['financeiro-custos', month],
    queryFn: () =>
      callFunction<FinanceCustosResponse>('financeiro-list-transacoes', {
        mode: 'custos',
        month,
      }),
  });

  const templates = custosQuery.data?.templates ?? [];
  const titulos = custosQuery.data?.titulos_mes ?? [];

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['financeiro-custos'] });
    void qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] });
    void qc.invalidateQueries({ queryKey: ['financeiro-transacoes'] });
  };

  const upsertCusto = useMutation({
    mutationFn: () =>
      callFunction('financeiro-upsert-transacao', {
        action: 'upsert_custo_recorrente',
        id: form.id,
        descricao: form.descricao.trim(),
        valor_cents: reaisInputToCents(form.valor),
        dia_vencimento: Math.min(28, Math.max(1, Number(form.dia_vencimento) || 1)),
        categoria: form.categoria,
        observacoes: form.observacoes.trim() || null,
        ativo: true,
      }),
    onSuccess: () => {
      setModalOpen(false);
      setForm(emptyForm);
      invalidate();
    },
  });

  const marcarPago = useMutation({
    mutationFn: (id: string) =>
      callFunction('financeiro-upsert-transacao', {
        action: 'marcar_pago',
        id,
      }),
    onSuccess: invalidate,
  });

  const toggleCusto = useMutation({
    mutationFn: ({ id, ativo }: { id: string; ativo: boolean }) =>
      callFunction('financeiro-upsert-transacao', {
        action: 'toggle_custo',
        id,
        ativo,
      }),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (t: FinanceCustoRecorrente) => {
    setForm({
      id: t.id,
      descricao: t.descricao,
      valor: centsToInputReais(t.valor_cents),
      dia_vencimento: String(t.dia_vencimento),
      categoria: t.categoria,
      observacoes: t.observacoes ?? '',
    });
    setModalOpen(true);
  };

  const pendentes = titulos.filter((t) => t.status === 'PENDENTE' || t.status === 'ATRASADO');
  const pagos = titulos.filter((t) => t.status === 'PAGO');

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-lg font-medium text-charcoal">Custos fixos</h2>
          <p className="mt-0.5 text-sm text-charcoal-muted">
            Cadastre aluguel e outros custos mensais. O sistema gera o título do mês; você marca quando pagar.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 sm:w-auto"
        >
          Novo custo fixo
        </button>
      </div>

      {custosQuery.isLoading && (
        <div className="space-y-2">
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        </div>
      )}

      {custosQuery.isError && (
        <p className="text-sm text-error">Não foi possível carregar os custos.</p>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-charcoal">Contas do mês</h3>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white">
          {titulos.length === 0 && !custosQuery.isLoading && (
            <li className="px-4 py-8 text-center text-sm text-charcoal-muted">
              Nenhum título neste mês. Cadastre um custo fixo para gerar a cobrança.
            </li>
          )}
          {titulos.map((t) => (
            <TituloRow
              key={t.id}
              titulo={t}
              onPagar={() => marcarPago.mutate(t.id)}
              paying={marcarPago.isPending && marcarPago.variables === t.id}
            />
          ))}
        </ul>
        {(pendentes.length > 0 || pagos.length > 0) && (
          <p className="mt-2 text-xs text-charcoal-muted">
            {pendentes.length} a pagar · {pagos.length} pagos neste mês
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-charcoal">Meus custos fixos</h3>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white">
          {templates.length === 0 && !custosQuery.isLoading && (
            <li className="px-4 py-8 text-center text-sm text-charcoal-muted">
              Nenhum custo fixo cadastrado ainda.
            </li>
          )}
          {templates.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-charcoal">
                  {t.descricao}
                  {!t.ativo && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      Pausado
                    </span>
                  )}
                </p>
                <p className="text-xs text-charcoal-muted">
                  Todo dia {t.dia_vencimento} · {formatCurrency(t.valor_cents)} · {t.categoria}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(t)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-slate-50"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => toggleCusto.mutate({ id: t.id, ativo: !t.ativo })}
                  disabled={toggleCusto.isPending}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-charcoal-muted hover:bg-slate-50"
                >
                  {t.ativo ? 'Pausar' : 'Reativar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <StandardModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setForm(emptyForm);
        }}
        title={form.id ? 'Editar custo fixo' : 'Novo custo fixo'}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                setForm(emptyForm);
              }}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm text-charcoal-muted hover:bg-slate-100 sm:w-auto"
            >
              Cancelar
            </button>
            <LoadingButton
              type="button"
              loading={upsertCusto.isPending}
              onClick={() => upsertCusto.mutate()}
              disabled={!form.descricao.trim() || !form.valor}
              className="w-full sm:w-auto"
            >
              Salvar
            </LoadingButton>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs text-charcoal-muted">
            Descrição *
            <input
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex.: Aluguel do consultório"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs text-charcoal-muted">
              Valor (R$) *
              <input
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                placeholder="2000,00"
                inputMode="decimal"
              />
            </label>
            <label className="block text-xs text-charcoal-muted">
              Dia do mês (1–28) *
              <input
                type="number"
                min={1}
                max={28}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal"
                value={form.dia_vencimento}
                onChange={(e) => setForm((f) => ({ ...f, dia_vencimento: e.target.value }))}
              />
            </label>
          </div>
          <label className="block text-xs text-charcoal-muted">
            Categoria
            <select
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal"
              value={form.categoria}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  categoria: e.target.value as 'CUSTO_FIXO' | 'IMPOSTO' | 'OUTROS',
                }))
              }
            >
              <option value="CUSTO_FIXO">Custo fixo</option>
              <option value="IMPOSTO">Imposto</option>
              <option value="OUTROS">Outros</option>
            </select>
          </label>
          <label className="block text-xs text-charcoal-muted">
            Observações
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-charcoal"
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              placeholder="Opcional"
            />
          </label>
        </div>
      </StandardModal>
    </section>
  );
}

function TituloRow({
  titulo,
  onPagar,
  paying,
}: {
  titulo: FinanceCustoTitulo;
  onPagar: () => void;
  paying: boolean;
}) {
  const meta = STATUS_META[titulo.status] ?? { label: titulo.status, className: 'bg-slate-100 text-slate-500' };
  const canPay = titulo.status === 'PENDENTE' || titulo.status === 'ATRASADO';
  const due = titulo.data_vencimento
    ? new Date(`${titulo.data_vencimento}T12:00:00`).toLocaleDateString('pt-BR')
    : '—';

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-charcoal">{titulo.descricao}</p>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
            {meta.label}
          </span>
        </div>
        <p className="text-xs text-charcoal-muted">Vence em {due}</p>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold text-charcoal">{formatCurrency(titulo.valor_cents)}</p>
        {canPay && (
          <button
            type="button"
            onClick={onPagar}
            disabled={paying}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {paying ? 'Salvando…' : 'Marcar como pago'}
          </button>
        )}
      </div>
    </li>
  );
}
