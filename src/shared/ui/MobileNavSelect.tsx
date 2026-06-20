export interface MobileNavSelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface MobileNavSelectProps<T extends string = string> {
  value: T;
  options: MobileNavSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

function ChevronDownIcon() {
  return (
    <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

/**
 * Seletor nativo para navegação entre subpáginas — apenas mobile (< sm).
 */
export function MobileNavSelect<T extends string = string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
}: MobileNavSelectProps<T>) {
  return (
    <div className={`relative sm:hidden ${className}`.trim()}>
      <label htmlFor={`mobile-nav-${ariaLabel.replace(/\s+/g, '-')}`} className="sr-only">
        {ariaLabel}
      </label>
      <select
        id={`mobile-nav-${ariaLabel.replace(/\s+/g, '-')}`}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-label={ariaLabel}
        className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-10 text-sm font-medium text-charcoal shadow-sm transition-colors focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon />
    </div>
  );
}
