import type { SVGProps } from 'react';

const SIZE_CLASS = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-10 w-10 md:h-12 md:w-12',
} as const;

export type SpinnerSize = keyof typeof SIZE_CLASS;

export interface SpinnerProps extends SVGProps<SVGSVGElement> {
  size?: SpinnerSize;
  label?: string;
}

export function Spinner({ size = 'md', label, className = '', ...props }: SpinnerProps) {
  return (
    <svg
      className={`animate-spin text-primary ${SIZE_CLASS[size]} ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label ?? 'Carregando'}
      aria-live="polite"
      {...props}
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
