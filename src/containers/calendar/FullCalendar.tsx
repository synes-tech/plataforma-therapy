import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { DayDetail } from '@features/calendar/DayDetail';

interface MonthlySummary {
  year: number;
  month: number;
  days: Array<{ date: string; total_sessions: number }>;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Data "hoje" no fuso BR como YYYY-MM-DD. */
function brTodayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Monta a matriz de 6 semanas (42 células) do mês. */
function buildGrid(year: number, month0: number): Array<{ iso: string; day: number; inMonth: boolean }> {
  const firstOfMonth = new Date(year, month0, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Dom
  const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];
  // começa no domingo anterior (ou no próprio dia 1 se for domingo)
  const start = new Date(year, month0, 1 - startWeekday);
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    cells.push({ iso, day: d.getDate(), inMonth: d.getMonth() === month0 });
  }
  return cells;
}

export default function FullCalendar() {
  const todayISO = brTodayISO();
  const todayParts = todayISO.split('-');
  const todayY = Number(todayParts[0]);
  const todayM = Number(todayParts[1]);

  const [cursor, setCursor] = useState({ year: todayY, month0: todayM - 1 });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['monthly-summary', cursor.year, cursor.month0],
    queryFn: () =>
      callFunction<MonthlySummary>('get-monthly-summary', {
        year: cursor.year,
        month: cursor.month0 + 1,
      }),
  });

  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    (data?.days ?? []).forEach((d) => m.set(d.date, d.total_sessions));
    return m;
  }, [data]);

  const grid = useMemo(() => buildGrid(cursor.year, cursor.month0), [cursor]);

  function goPrev() {
    setCursor((c) => (c.month0 === 0 ? { year: c.year - 1, month0: 11 } : { year: c.year, month0: c.month0 - 1 }));
  }
  function goNext() {
    setCursor((c) => (c.month0 === 11 ? { year: c.year + 1, month0: 0 } : { year: c.year, month0: c.month0 + 1 }));
  }
  function goToday() {
    setCursor({ year: todayY, month0: todayM - 1 });
  }

  return (
    <div className="bg-[#F8FAF9] px-4 py-6 lg:px-8 lg:py-8">
      {/* Cabeçalho / navegação */}
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
            {MONTHS[cursor.month0]} {cursor.year}
          </h1>
          <p className="mt-1 text-sm text-charcoal-muted">Sua agenda completa do mês.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToday}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50"
          >
            Hoje
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={goPrev}
              aria-label="Mês anterior"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-charcoal transition-colors hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goNext}
              aria-label="Próximo mês"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-charcoal transition-colors hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted/70">
            <span className="hidden sm:inline">{w}</span>
            <span className="sm:hidden">{w[0]}</span>
          </div>
        ))}
      </div>

      {/* Grid do mês */}
      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {grid.map((cell) => {
          const count = countByDate.get(cell.iso) ?? 0;
          const isToday = cell.iso === todayISO;
          return (
            <button
              key={cell.iso}
              onClick={() => cell.inMonth && setSelectedDate(cell.iso)}
              disabled={!cell.inMonth}
              className={`flex min-h-[72px] flex-col rounded-xl border p-1.5 text-left transition-colors md:min-h-[120px] md:p-2 ${
                !cell.inMonth
                  ? 'cursor-default border-transparent bg-transparent'
                  : isToday
                    ? 'border-blue-400 bg-blue-50/50 hover:border-blue-500'
                    : 'border-slate-100 bg-white hover:border-blue-200'
              }`}
            >
              <span
                className={`text-xs md:text-sm ${
                  !cell.inMonth
                    ? 'text-transparent'
                    : isToday
                      ? 'font-bold text-blue-700'
                      : 'font-medium text-charcoal'
                }`}
              >
                {cell.day}
              </span>

              {cell.inMonth && count > 0 && (
                <span className="mt-auto rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 md:px-2 md:py-1 md:text-xs">
                  {count} {count === 1 ? 'sessão' : 'sessões'}
                </span>
              )}
              {cell.inMonth && count > 0 && isLoading && null}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <p className="mt-4 text-center text-xs text-charcoal-muted">Carregando agenda...</p>
      )}

      {/* Modal de detalhe do dia */}
      <StandardModal
        isOpen={!!selectedDate}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? formatDayTitle(selectedDate) : 'Agenda do dia'}
        size="lg"
      >
        {selectedDate && (
          <DayDetail
            date={selectedDate}
            onRescheduled={() => {
              // invalida resumo do mês ao remarcar
            }}
          />
        )}
      </StandardModal>
    </div>
  );
}

function formatDayTitle(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d);
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  const long = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(date);
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap}, ${long}`;
}
