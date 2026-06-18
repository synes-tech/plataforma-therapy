import { Link } from 'react-router-dom';
import { StandardModal } from '@shared/ui/StandardModal';

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  ctaHref?: string;
  ctaLabel?: string;
  helperText?: string;
}

/**
 * Modal exibido quando cota excedida — convida upgrade ou compra de add-on.
 */
export function UpgradePlanModal({
  isOpen,
  onClose,
  title = 'Limite do plano atingido',
  message,
  ctaHref = '/billing',
  ctaLabel = 'Ver planos e fazer upgrade',
  helperText = 'Seu plano atual atingiu a cota de uso. Faça upgrade para continuar.',
}: UpgradePlanModalProps) {
  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted md:w-auto"
          >
            Fechar
          </button>
          <Link
            to={ctaHref}
            onClick={onClose}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-charcoal px-6 text-sm font-medium text-white shadow-sm md:w-auto"
          >
            {ctaLabel}
          </Link>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-charcoal-muted">{message}</p>
      <p className="mt-3 text-xs text-charcoal-muted/80">{helperText}</p>
    </StandardModal>
  );
}
