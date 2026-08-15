import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { LoadingButton } from '@containers/loading';
import type { FinanceContractWindow } from '@containers/financeiro/financeiro.types';
import { invalidateFinanceAndAgendaQueries } from '@containers/financeiro/invalidate-finance';
import {
  EMPTY_WINDOW,
  WEEKDAYS,
  normalizeWindowTime,
  previewOccurrences,
  weekdayLabel,
  type RecurrenceWindowDraft,
} from './recurrence-windows';

interface RecurrenceWindowsModalProps {
  isOpen: boolean;
  patientId: string;
  patientName?: string;
  onClose: () => void;
  onSaved?: () => void;
  allowSkip?: boolean;
}

function draftsFromApi(janelas: FinanceContractWindow[] | undefined): RecurrenceWindowDraft[] {
  if (!janelas?.length) return [{ ...EMPTY_WINDOW }];
  return janelas.map((item) => ({
    weekday: item.weekday,
    start_time: normalizeWindowTime(item.start_time),
    duration_minutes: item.duration_minutes || 50,
  }));
}

export function RecurrenceWindowsModal({
  isOpen,
  patientId,
  patientName,
  onClose,
  onSaved,
  allowSkip = false,
}: RecurrenceWindowsModalProps) {
  const qc = useQueryClient();
  const [windows, setWindows] = useState<RecurrenceWindowDraft[]>([{ ...EMPTY_WINDOW }]);
  const [formError, setFormError] = useState<string | null>(null);

  const contractQuery = useQuery({
    queryKey: ['financeiro-ledger', patientId],
    queryFn: () =>
      callFunction<{
        janelas?: FinanceContractWindow[];
        contract?: { valor_acordado_cents?: number; due_day?: number | null } | null;
      }>('financeiro-upsert-patient-plan', { action: 'get_contract', patient_id: patientId }),
    enabled: isOpen && Boolean(patientId),
  });

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setWindows(draftsFromApi(contractQuery.data?.janelas));
  }, [isOpen, contractQuery.data?.janelas]);

  const preview = useMemo(() => previewOccurrences(windows), [windows]);
  const dueDay = contractQuery.data?.contract?.due_day;

  const saveMutation = useMutation({
    mutationFn: () => {
      const unique = new Set(windows.map((item) => `${item.weekday}@${normalizeWindowTime(item.start_time)}`));
      if (unique.size !== windows.length) {
        throw new Error('Há horários duplicados no mesmo dia.');
      }
      return callFunction<{
        needs_windows?: boolean;
        sync?: { invoices_created?: number; agenda?: { created?: number; conflicts?: number } };
      }>('financeiro-upsert-patient-plan', {
        action: 'upsert_windows',
        patient_id: patientId,
        janelas: windows.map((item) => ({
          weekday: item.weekday,
          start_time: normalizeWindowTime(item.start_time),
          duration_minutes: item.duration_minutes || 50,
        })),
      });
    },
    onSuccess: () => {
      invalidateFinanceAndAgendaQueries(qc);
      onSaved?.();
      onClose();
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : 'Não foi possível salvar os horários.');
    },
  });

  function updateRow(index: number, patch: Partial<RecurrenceWindowDraft>) {
    setWindows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Horários da agenda"
      size="lg"
      closeOnBackdropClick={!saveMutation.isPending}
      footer={
        <>
          {allowSkip && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm text-charcoal-muted hover:bg-slate-100"
            >
              Definir depois
            </button>
          )}
          {!allowSkip && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm text-charcoal-muted hover:bg-slate-100"
            >
              Cancelar
            </button>
          )}
          <LoadingButton
            type="button"
            loading={saveMutation.isPending}
            onClick={() => {
              setFormError(null);
              saveMutation.mutate();
            }}
          >
            Popular agenda e gerar fatura
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-charcoal-muted">
          {patientName ? (
            <>
              Combine os horários fixos de <strong className="font-medium text-charcoal">{patientName}</strong>.
            </>
          ) : (
            'Combine os horários fixos deste paciente.'
          )}{' '}
          Uma fatura do mês entra em a receber
          {dueDay ? ` (vence dia ${dueDay})` : ''} e as sessões aparecem na agenda — sem cobrança por sessão.
        </p>

        <div className="space-y-3">
          {windows.map((row, index) => (
            <div
              key={`${row.weekday}-${index}`}
              className="rounded-2xl border border-slate-100 bg-white p-3 sm:flex sm:items-end sm:gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-charcoal-muted">Dia</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.iso}
                      type="button"
                      onClick={() => updateRow(index, { weekday: day.iso })}
                      className={`h-9 min-w-10 rounded-xl px-2 text-xs font-medium ${
                        row.weekday === day.iso
                          ? 'bg-primary text-white'
                          : 'border border-slate-200 bg-white text-charcoal hover:border-primary/30'
                      }`}
                      aria-pressed={row.weekday === day.iso}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </div>
              <label className="mt-3 block sm:mt-0 sm:w-28">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">Horário</span>
                <input
                  type="time"
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                  value={normalizeWindowTime(row.start_time)}
                  onChange={(e) => updateRow(index, { start_time: e.target.value })}
                />
              </label>
              <label className="mt-3 block sm:mt-0 sm:w-24">
                <span className="mb-1 block text-xs font-medium text-charcoal-muted">Minutos</span>
                <input
                  type="number"
                  min={15}
                  max={240}
                  step={5}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
                  value={row.duration_minutes}
                  onChange={(e) => updateRow(index, { duration_minutes: Number(e.target.value) || 50 })}
                />
              </label>
              {windows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setWindows((current) => current.filter((_, i) => i !== index))}
                  className="mt-3 h-11 rounded-xl px-3 text-xs text-charcoal-muted hover:bg-slate-100 sm:mt-0"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>

        {windows.length < 8 && (
          <button
            type="button"
            onClick={() => setWindows((current) => [...current, { ...EMPTY_WINDOW }])}
            className="text-sm font-medium text-primary hover:underline"
          >
            + Outro horário na semana
          </button>
        )}

        {preview.length > 0 && (
          <div className="rounded-2xl border border-primary/15 bg-primary-50/50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Próximas sessões</p>
            <ul className="mt-2 space-y-1 text-sm text-charcoal">
              {preview.map((item) => (
                <li key={`${item.date}-${item.time}`}>
                  {item.label}
                  <span className="text-charcoal-muted"> · {weekdayLabel(item.weekday)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(formError || saveMutation.isError) && (
          <p className="text-xs text-error">{formError ?? (saveMutation.error as Error).message}</p>
        )}
      </div>
    </StandardModal>
  );
}
