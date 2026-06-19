import type { ReactNode } from 'react';

export interface PageHeaderBackButton {
  onClick: () => void;
  label?: string;
}

export interface PageHeaderProps {
  /** Título principal da tela. */
  title: ReactNode;
  /** Texto ou conteúdo de apoio abaixo do título. */
  subtitle?: ReactNode;
  /** Botões de ação alinhados à direita (ex.: Novo Paciente). */
  actions?: ReactNode;
  /** Navegação interna (tabs) na base do cabeçalho. */
  tabs?: ReactNode;
  /** Exibe link/botão de voltar acima do título. */
  backButton?: PageHeaderBackButton;
  /** Classes extras no elemento raiz. */
  className?: string;
  /** Margens negativas para largura total (padrão em páginas com padding). */
  bleed?: boolean;
}

/**
 * Margens negativas para o header ocupar a largura total dentro de páginas com padding padrão.
 * Use o mesmo padding no container da página: px-4 sm:px-6 lg:px-8
 */
export const PAGE_HEADER_BLEED =
  '-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8';

function BackChevron() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

/**
 * Cabeçalho fixo (sticky) reutilizável para telas internas.
 * Ancora no topo da área de scroll principal, à direita da sidebar.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  tabs,
  backButton,
  className = '',
  bleed = true,
}: PageHeaderProps) {
  const bleedClass = bleed ? PAGE_HEADER_BLEED : 'px-4 sm:px-6 lg:px-8';

  return (
    <header
      className={`sticky top-0 z-40 shrink-0 border-b border-slate-100 bg-white/90 backdrop-blur-md ${bleedClass} ${className}`.trim()}
    >
      <div className="py-4 lg:py-5">
        {backButton && (
          <button
            type="button"
            onClick={backButton.onClick}
            className="mb-3 inline-flex items-center gap-1 text-xs text-charcoal-muted transition-colors hover:text-primary"
          >
            <BackChevron />
            {backButton.label ?? 'Voltar'}
          </button>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            {typeof title === 'string' ? (
              <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
                {title}
              </h1>
            ) : (
              title
            )}
            {subtitle != null && (
              typeof subtitle === 'string' ? (
                <p className="mt-0.5 text-sm text-charcoal-muted">{subtitle}</p>
              ) : (
                <div className="mt-1.5">{subtitle}</div>
              )
            )}
          </div>

          {actions && (
            <div className="flex w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
              {actions}
            </div>
          )}
        </div>

        {tabs && <div className="mt-4">{tabs}</div>}
      </div>
    </header>
  );
}
