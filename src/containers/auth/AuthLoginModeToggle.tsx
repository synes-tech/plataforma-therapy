export type AuthLoginMode = 'therapist' | 'family';

interface AuthLoginModeToggleProps {
  mode: AuthLoginMode;
  onChange: (mode: AuthLoginMode) => void;
}

export function AuthLoginModeToggle({ mode, onChange }: AuthLoginModeToggleProps) {
  return (
    <div
      className="mb-6 flex w-full rounded-xl border border-slate-200 bg-slate-50/80 p-1"
      role="tablist"
      aria-label="Tipo de acesso"
    >
      {(
        [
          { id: 'therapist' as const, label: 'Terapeuta' },
          { id: 'family' as const, label: 'Acesso família' },
        ] as const
      ).map(({ id, label }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              active
                ? 'bg-white text-charcoal shadow-sm ring-1 ring-slate-200/80'
                : 'text-charcoal-muted hover:text-charcoal'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
