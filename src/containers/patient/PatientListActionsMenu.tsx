import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PatientListActionsMenuProps {
  onOpenCentral: () => void;
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
}

const menuItemClass =
  'flex min-h-11 w-full items-center px-4 py-2.5 text-left text-xs font-bold tracking-wide transition-colors';

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
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

export function PatientListActionsMenu({
  onOpenCentral,
  onEdit,
  onDelete,
  compact = true,
}: PatientListActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; minWidth: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setPos(null);
      return;
    }

    function update() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
        minWidth: Math.max(rect.width, 196),
      });
    }

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
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
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: pos.top, right: pos.right, minWidth: pos.minWidth }}
            className="fixed z-[55] overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onOpenCentral();
              }}
              className={`${menuItemClass} text-charcoal hover:bg-slate-50`}
            >
              ACESSAR CENTRAL
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className={`${menuItemClass} text-charcoal hover:bg-slate-50`}
            >
              EDITAR
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className={`${menuItemClass} text-error hover:bg-error-light/40`}
            >
              DELETE
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          compact
            ? 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold uppercase tracking-wide text-charcoal shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50'
            : 'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold uppercase tracking-wide text-charcoal shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50'
        }
      >
        Ações
        <ChevronIcon open={open} />
      </button>
      {menu}
    </>
  );
}
