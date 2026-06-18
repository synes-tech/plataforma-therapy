import type { ReactNode } from 'react';

const SECTION_ICONS: Record<string, string> = {
  'Dados Básicos': '👤',
  'Contexto Clínico': '🧬',
  'Dinâmica Familiar': '👨‍👩‍👧',
  'Parametrização IA': '✨',
};

interface ClinicalRecordSectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function ClinicalRecordSectionCard({
  title,
  description,
  children,
}: ClinicalRecordSectionCardProps) {
  const icon = SECTION_ICONS[title] ?? '📋';

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
      <header className="mb-5 flex items-start gap-3 border-b border-slate-50 pb-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-lg"
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold text-charcoal">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-charcoal-muted">{description}</p>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Grid responsivo: coluna no mobile, 2 colunas no desktop (8pt: gap-6). */
export function ClinicalFieldsGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">{children}</div>;
}

export function ClinicalFieldsStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 sm:gap-6">{children}</div>;
}
