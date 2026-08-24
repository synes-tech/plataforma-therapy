import { useState } from 'react';
import type { DiaryMonthCheckin } from './dashboard.types';
import { DashboardFamilyDayModal } from './DashboardFamilyDayModal';
import { buildMonthCells, monthTitle } from './home.utils';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface DashboardFamilyFeedProps {
  month?: string;
  checkinDays?: string[];
  entries?: DiaryMonthCheckin[];
  today?: string;
  loading?: boolean;
}

export function DashboardFamilyFeed({
  month,
  checkinDays = [],
  entries = [],
  today,
  loading,
}: DashboardFamilyFeedProps) {
  const monthKey = month ?? today?.slice(0, 7) ?? '';
  const cells = buildMonthCells(monthKey);
  const filled = new Set(checkinDays);
  const checkinCount = checkinDays.length;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
      <header className="mb-2">
        <h2 className="font-display text-sm font-semibold text-charcoal">Diário da família</h2>
        <p className="mt-0.5 text-[11px] text-charcoal-muted">
          {monthKey ? monthTitle(monthKey) : 'Check-ins do mês'}
          {checkinCount > 0 ? ` · ${checkinCount} dia${checkinCount === 1 ? '' : 's'}` : ''}
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }, (_, index) => (
            <div key={index} className="aspect-square animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((label, index) => (
              <span key={`${label}-${index}`} className="text-center text-[9px] font-semibold uppercase text-charcoal-muted">
                {label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, index) => {
              if (cell.day === null || !cell.dateKey) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }
              const hasCheckin = filled.has(cell.dateKey);
              const isToday = cell.dateKey === today;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateKey!)}
                  aria-label={
                    hasCheckin
                      ? `Ver check-ins de ${cell.day}`
                      : `Nenhum check-in em ${cell.day}. Abrir detalhes`
                  }
                  className={`flex aspect-square items-center justify-center rounded-md text-[10px] font-medium tabular-nums transition-colors hover:ring-2 hover:ring-primary/30 ${
                    hasCheckin
                      ? 'bg-alert text-amber-950'
                      : isToday
                        ? 'border border-primary/40 bg-primary-50 text-primary'
                        : 'bg-slate-100 text-charcoal-muted'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </>
      )}

      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-charcoal-muted">
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-alert" />
          Check-in
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-slate-100" />
          Sem registro
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-primary/40 bg-primary-50" />
          Hoje
        </li>
      </ul>

      <DashboardFamilyDayModal
        date={selectedDate}
        entries={entries}
        onClose={() => setSelectedDate(null)}
      />
    </section>
  );
}
