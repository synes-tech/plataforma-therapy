import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional action buttons rendered in the standardized footer. */
  footer?: React.ReactNode;
  /** Max width of the desktop dialog. Defaults to a balanced 'lg'. */
  size?: 'md' | 'lg' | 'xl';
}

const SIZE_MAP: Record<NonNullable<StandardModalProps['size']>, string> = {
  md: 'md:max-w-md',
  lg: 'md:max-w-lg',
  xl: 'md:max-w-2xl',
};

/**
 * StandardModal — componente universal de modal da plataforma Therapy.AI.
 *
 * Padrão arquitetural ÚNICO para formulários de criação/edição e confirmações:
 * - Desktop: diálogo centralizado com glassmorphism no backdrop.
 * - Mobile (< 768px): bottom sheet deslizante com "puxador".
 *
 * Acessibilidade: role="dialog", aria-modal, foco inicial, fechar com Esc,
 * bloqueio de scroll do body e clique no backdrop para fechar.
 */
export function StandardModal({ isOpen, onClose, title, children, footer, size = 'lg' }: StandardModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Fechar com Esc + bloquear scroll do body enquanto aberto
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  // Foco inicial no diálogo ao abrir
  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm transition-opacity md:items-center md:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none md:max-h-[90dvh] md:animate-scale-in md:rounded-2xl ${SIZE_MAP[size]}`}
      >
        {/* Puxador (mobile bottom sheet) */}
        <div className="mx-auto mb-1 mt-2 h-1.5 w-12 shrink-0 rounded-full bg-slate-200 md:hidden" />

        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <h2 id={titleId} className="font-serif text-lg font-medium tracking-tight text-charcoal">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-charcoal-muted/70 transition-colors hover:bg-slate-100 hover:text-charcoal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {/* Footer */}
        {footer && (
          <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-4 py-4 md:flex-row md:justify-end md:rounded-b-2xl">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
