import { useCallback, useRef } from 'react';

interface PhoneInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}

/**
 * Máscara rigorosa de telefone brasileiro: (99) 99999-9999
 *
 * - Bloqueia letras e caracteres especiais (apenas dígitos aceitos)
 * - Formata automaticamente caractere por caractere
 * - Trata colagem (paste) de texto — extrai apenas dígitos e aplica máscara
 * - Limite de 11 dígitos (DDD + número)
 */

const MAX_DIGITS = 11;

/**
 * Remove tudo que não for dígito.
 */
function stripNonDigits(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Aplica a máscara (XX) XXXXX-XXXX sobre os dígitos puros.
 */
function applyPhoneMask(digits: string): string {
  const d = digits.slice(0, MAX_DIGITS);
  const len = d.length;

  if (len === 0) return '';
  if (len <= 2) return `(${d}`;
  if (len <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function PhoneInput({
  id,
  label,
  value,
  onChange,
  placeholder = '(11) 99999-0000',
  required = false,
  autoComplete = 'tel',
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const digits = stripNonDigits(raw);
      const masked = applyPhoneMask(digits);
      onChange(masked);
    },
    [onChange],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, arrows, home, end
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End',
    ];
    if (allowedKeys.includes(e.key)) return;

    // Allow Ctrl/Cmd + A, C, V, X (select all, copy, paste, cut)
    if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;

    // Block anything that isn't a digit
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }

    // Block if we already have max digits
    const currentDigits = stripNonDigits((e.target as HTMLInputElement).value);
    if (/^\d$/.test(e.key) && currentDigits.length >= MAX_DIGITS) {
      e.preventDefault();
    }
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedText = e.clipboardData.getData('text');
      const digits = stripNonDigits(pastedText);
      const masked = applyPhoneMask(digits);
      onChange(masked);
    },
    [onChange],
  );

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-charcoal">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={15} /* (XX) XXXXX-XXXX = 15 chars */
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-charcoal transition-all duration-200 placeholder:text-charcoal-muted/40 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 md:h-10"
      />
    </div>
  );
}
