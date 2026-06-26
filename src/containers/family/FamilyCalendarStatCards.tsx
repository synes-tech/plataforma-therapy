type StatAccent = 'primary' | 'mint' | 'amber' | 'muted';

export interface FamilyCalendarStatItem {
  value: number | string;
  label: string;
  accent?: StatAccent;
}

const ACCENT_CLASS: Record<StatAccent, string> = {
  primary: 'text-primary',
  mint: 'text-mint-dark',
  amber: 'text-amber-600',
  muted: 'text-charcoal-muted',
};

interface FamilyCalendarStatCardsProps {
  items: readonly [FamilyCalendarStatItem, FamilyCalendarStatItem, FamilyCalendarStatItem];
}

export function FamilyCalendarStatCards({ items }: FamilyCalendarStatCardsProps) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-100 bg-white px-2 py-3 text-center shadow-sm sm:px-3"
        >
          <p className={`text-lg font-semibold sm:text-xl ${ACCENT_CLASS[item.accent ?? 'primary']}`}>
            {item.value}
          </p>
          <p className="mt-0.5 text-[10px] font-medium uppercase leading-tight tracking-wide text-charcoal-muted/70">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}
