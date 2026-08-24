import { normalizeInviteCodeInput } from './invite-code-preview.utils';

interface InviteCodeFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputClassName?: string;
  helperText?: string;
}

export function InviteCodeField({
  id,
  label,
  value,
  onChange,
  inputClassName = '',
  helperText,
}: InviteCodeFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-charcoal sm:mb-1.5 sm:text-sm">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(normalizeInviteCodeInput(e.target.value))}
        onPaste={(e) => {
          e.preventDefault();
          const pasted = e.clipboardData.getData('text');
          onChange(normalizeInviteCodeInput(pasted));
        }}
        required
        maxLength={8}
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        placeholder="AbC12xYz"
        aria-describedby={helperText ? `${id}-helper` : undefined}
        className={inputClassName}
      />
      {helperText ? (
        <p id={`${id}-helper`} className="mt-1 text-[11px] text-charcoal-muted sm:text-xs">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
