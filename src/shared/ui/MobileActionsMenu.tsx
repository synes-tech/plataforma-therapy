import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface MobileActionItem {
  id: string;
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: 'default' | 'primary';
  disabled?: boolean;
}

interface MobileActionsMenuProps {
  items: MobileActionItem[];
  label?: string;
  className?: string;
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
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
  right: number;
  minWidth: number;
}

/**
 * Botão "Ações" com menu dropdown — apenas mobile (< sm).
 * Menu renderizado via portal para sobrepor todo o conteúdo da página.
 */
export function MobileActionsMenu({ items, label = 'Ações', className = '' }: MobileActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
        right: Math.max(8, window.innerWidth - rect.right),
        minWidth: Math.max(rect.width, 192),
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
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
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

  if (items.length === 0) return null;

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              top: menuPos.top,
              right: menuPos.right,
              minWidth: menuPos.minWidth,
            }}
            className="fixed z-[45] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-xl"
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onClick();
                }}
                className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  item.variant === 'primary'
                    ? 'text-primary hover:bg-primary-50'
                    : 'text-charcoal hover:bg-slate-50'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={`relative sm:hidden ${className}`.trim()}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-charcoal shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          {label}
          <ChevronDownIcon open={open} />
        </button>
      </div>
      {menu}
    </>
  );
}
