interface SettingsSectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  action,
  children,
  className = '',
}: SettingsSectionProps) {
  return (
    <section
      className={`flex h-full w-full flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 ${className}`.trim()}
    >
      <header className="mb-5">
        <h2 className="font-serif text-xl font-medium tracking-tight text-charcoal">{title}</h2>
        {(description || action) && (
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            {description && (
              <p className="max-w-xl text-sm leading-relaxed text-charcoal-muted">{description}</p>
            )}
            {action && <div className="shrink-0 sm:pt-0.5">{action}</div>}
          </div>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  hint?: string;
  className?: string;
}

export function SettingsField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  readOnly,
  hint,
  className = '',
}: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-charcoal">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={`h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-charcoal transition-all placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 ${
          readOnly ? 'cursor-default bg-slate-50 text-charcoal-muted' : 'bg-white'
        }`}
      />
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-charcoal-muted">{hint}</p>}
    </div>
  );
}

interface ValueProps {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}

export function SettingsValue({ label, value, hint, className = '' }: ValueProps) {
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted/70">
        {label}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-charcoal">{value.trim() ? value : '—'}</p>
      {hint && <p className="mt-1 text-xs leading-relaxed text-charcoal-muted">{hint}</p>}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
}

export function SettingsToggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-charcoal">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-charcoal-muted">{description}</p>
      </div>
      {disabled ? (
        <span
          className={`shrink-0 text-xs font-medium ${
            checked ? 'text-mint-dark' : 'text-charcoal-muted'
          }`}
        >
          {checked ? 'Ativo' : 'Desligado'}
        </span>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
            checked ? 'bg-primary' : 'bg-slate-200'
          }`}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow-sm transition-all duration-200 ${
              checked
                ? 'translate-x-5 bg-white'
                : 'translate-x-0 bg-white ring-1 ring-slate-300/60'
            }`}
          />
        </button>
      )}
    </div>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-charcoal">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-charcoal-muted">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsGhostButton({
  children,
  onClick,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick: () => void;
  type?: 'button';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="text-sm font-medium text-primary transition-colors hover:text-primary-dark"
    >
      {children}
    </button>
  );
}
