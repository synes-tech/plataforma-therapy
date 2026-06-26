import {
  DIARY_MAX_RETROACTIVE_DAYS,
  formatEntryDateLong,
  isTodayEntryDate,
  minRetroactiveEntryDateKey,
  todayEntryDateKey,
} from './routine-diary.utils';

interface RoutineDiaryEntryDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function RoutineDiaryEntryDateField({ value, onChange, disabled }: RoutineDiaryEntryDateFieldProps) {
  const today = todayEntryDateKey();
  const minDate = minRetroactiveEntryDateKey();

  return (
    <section className="w-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 className="text-sm font-medium text-charcoal">Data do check-in</h4>
          <p className="mt-1 text-xs text-charcoal-muted">
            Esqueceu de registrar? Escolha o dia correto (até {DIARY_MAX_RETROACTIVE_DAYS} dias atrás). Você pode
            enviar vários registros no mesmo dia.
          </p>
        </div>
        <div className="shrink-0">
          <label htmlFor="routine-entry-date" className="sr-only">
            Data do check-in
          </label>
          <input
            id="routine-entry-date"
            type="date"
            value={value}
            min={minDate}
            max={today}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 w-full min-w-[11rem] rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-charcoal outline-none transition-colors focus:border-primary/40 focus:bg-white focus:ring-[3px] focus:ring-primary/10 disabled:opacity-50 sm:w-auto"
          />
        </div>
      </div>
      {!isTodayEntryDate(value) ? (
        <p className="mt-3 rounded-lg bg-amber-50/80 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200/80">
          Registrando para <span className="font-semibold capitalize">{formatEntryDateLong(value)}</span>
        </p>
      ) : null}
    </section>
  );
}
