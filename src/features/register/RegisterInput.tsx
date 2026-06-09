interface RegisterInputProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
  autoComplete?: string;
}

export function RegisterInput({
  id,
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  placeholder,
  minLength,
  autoComplete,
}: RegisterInputProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-charcoal">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        minLength={minLength}
        autoComplete={autoComplete}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal transition-all duration-200 placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 md:h-10"
      />
    </div>
  );
}
