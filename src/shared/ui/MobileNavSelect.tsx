import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  dataTour?: string;
  /** Quando exibir o seletor. Padrão: só abaixo de `sm`. */
  visibilityClassName?: string;
  /** Classe extra no menu portaled (ex.: z-index acima de modal). */
  menuClassName?: string;
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-charcoal-muted transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
}

/**
 * Seletor de subpáginas no mobile — menu customizado (não usa <select> nativo,
 * cuja lista no iOS/Android fica com letra ilegível).
 */
export function MobileNavSelect<T extends string = string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  dataTour,
  visibilityClassName = 'sm:hidden',
  menuClassName = '',
}: MobileNavSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuPos(null);
      return;
    }

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        left: Math.max(8, rect.left),
        width: Math.min(rect.width, window.innerWidth - 16),
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    function handleScroll() {
      setOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
            className={`fixed max-h-[min(22rem,70vh)] overflow-y-auto rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl ${
              menuClassName || 'z-[45]'
            }`}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-base font-medium leading-snug transition-colors ${
                    isSelected
                      ? 'bg-primary-50 text-primary'
                      : 'text-charcoal hover:bg-slate-50'
                  }`}
                >
                  <span>{option.label}</span>
                  {isSelected && (
                    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={`relative ${visibilityClassName} ${className}`.trim()} data-tour={dataTour}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-base font-medium text-charcoal shadow-sm transition-colors focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
        >
          <span className="truncate">{selected?.label ?? 'Selecionar'}</span>
          <ChevronDownIcon open={open} />
        </button>
      </div>
      {menu}
    </>
  );
}
