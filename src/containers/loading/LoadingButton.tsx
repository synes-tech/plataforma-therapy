import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

const VARIANT_CLASS = {
  primary:
    'bg-primary text-white shadow-sm hover:bg-primary-dark active:scale-[0.98]',
  secondary:
    'border border-slate-200 bg-white text-charcoal hover:border-charcoal/30',
  danger:
    'bg-error text-white hover:bg-error/90',
  ghost:
    'text-charcoal-muted hover:bg-slate-100',
  dark:
    'bg-charcoal text-white shadow-sm hover:bg-charcoal-light active:scale-[0.98]',
} as const;

export type LoadingButtonVariant = keyof typeof VARIANT_CLASS;

export interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
  variant?: LoadingButtonVariant;
  fullWidth?: boolean;
  children: ReactNode;
}

export function LoadingButton({
  loading = false,
  loadingLabel,
  variant = 'primary',
  fullWidth = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...props
}: LoadingButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        fullWidth ? 'w-full' : ''
      } h-11 ${VARIANT_CLASS[variant]} ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <>
          <Spinner size="sm" className={variant === 'primary' || variant === 'danger' || variant === 'dark' ? 'text-white' : ''} />
          {loadingLabel ? <span>{loadingLabel}</span> : null}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Botão compacto para toolbars e ações inline. */
export interface InlineLoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: ReactNode;
}

export function InlineLoadingButton({
  loading = false,
  disabled,
  children,
  className = '',
  type = 'button',
  ...props
}: InlineLoadingButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 disabled:opacity-50 ${className}`.trim()}
      {...props}
    >
      {loading ? <Spinner size="xs" /> : children}
    </button>
  );
}
