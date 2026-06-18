import type { ReactNode } from 'react';

/** Rótulo escaneável — padrão NN/g: label acima do valor, menor contraste (WCAG). */
export function ClinicalLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <span
      className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal-muted"
      {...(htmlFor ? { id: `${htmlFor}-label` } : {})}
    >
      {children}
    </span>
  );
}

export function ClinicalEmptyValue() {
  return <span className="text-base italic text-charcoal-muted/50">Não preenchido</span>;
}

interface ClinicalValueProps {
  value?: string | null;
  multiline?: boolean;
}

/** Valor em modo leitura — alto contraste, empty state amigável. */
export function ClinicalValue({ value, multiline }: ClinicalValueProps) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return (
      <p className="text-base font-medium text-charcoal">
        <ClinicalEmptyValue />
      </p>
    );
  }

  if (multiline) {
    return (
      <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-charcoal">
        {trimmed}
      </p>
    );
  }

  return <p className="text-base font-medium text-charcoal">{trimmed}</p>;
}

interface ClinicalFieldGroupProps {
  label: string;
  error?: string;
  fullWidth?: boolean;
  children: ReactNode;
}

/** Agrupa label + controle (leitura ou edição). */
export function ClinicalFieldGroup({ label, error, fullWidth, children }: ClinicalFieldGroupProps) {
  return (
    <div className={fullWidth ? 'md:col-span-2' : undefined}>
      <ClinicalLabel>{label}</ClinicalLabel>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
