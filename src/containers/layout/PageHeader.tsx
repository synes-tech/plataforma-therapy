import type { ReactNode } from 'react';

export interface PageHeaderBackButton {
  onClick: () => void;
  label?: string;
}

export interface PageHeaderProps {
  /** Título principal da tela. */
  title: ReactNode;
  /**
   * Título exibido só no desktop. No mobile continua `title`.
   * Use quando a barra compacta pede um nome curto (ex.: "Agenda").
   */
  desktopTitle?: string;
  /** Texto ou conteúdo de apoio abaixo do título — visível só no mobile. */
  subtitle?: ReactNode;
  /** Botões de ação alinhados à direita (ex.: Novo Paciente). */
  actions?: ReactNode;
  /** Navegação interna (tabs). No desktop fica na mesma linha, à direita. */
  tabs?: ReactNode;
  /** Exibe link/botão de voltar acima do título no mobile e ao lado no desktop. */
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
 * Cabeçalho de página reutilizável para telas internas.
 * Mobile: título maior, subtítulo e blocos empilhados (sem sticky).
 * Desktop (lg+): barra compacta de uma linha, colada no topo, título à esquerda e ações à direita.
 */
export function PageHeader({
  title,
  desktopTitle,
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
      className={`shrink-0 border-b border-slate-100 bg-white/90 backdrop-blur-md lg:sticky lg:top-0 lg:z-40 lg:border-slate-200/80 ${bleedClass} ${className}`.trim()}
    >
      {backButton ? (
        <button
          type="button"
          onClick={backButton.onClick}
          className="mt-4 inline-flex items-center gap-1 text-xs text-charcoal-muted transition-colors hover:text-primary lg:hidden"
        >
          <BackChevron />
          {backButton.label ?? 'Voltar'}
        </button>
      ) : null}

      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4 lg:h-14 lg:flex-nowrap lg:items-center lg:justify-start lg:gap-3 lg:py-0">
        <div className="flex min-w-0 items-center gap-3">
          {backButton ? (
            <button
              type="button"
              onClick={backButton.onClick}
              className="hidden shrink-0 items-center gap-1 text-xs font-medium text-charcoal-muted transition-colors hover:text-primary lg:inline-flex"
            >
              <BackChevron />
              {backButton.label ?? 'Voltar'}
            </button>
          ) : null}

          <div className="min-w-0">
            {typeof title === 'string' ? (
              <>
                <h1
                  className={`truncate font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl lg:font-display lg:text-[20px] lg:font-semibold lg:leading-none lg:tracking-tight ${
                    desktopTitle ? 'lg:hidden' : ''
                  }`}
                >
                  {title}
                </h1>
                {desktopTitle ? (
                  <h1 className="hidden truncate font-display text-[20px] font-semibold leading-none tracking-tight text-charcoal lg:block">
                    {desktopTitle}
                  </h1>
                ) : null}
              </>
            ) : (
              title
            )}
            {subtitle != null ? (
              typeof subtitle === 'string' ? (
                <p className="mt-0.5 text-sm text-charcoal-muted lg:hidden">{subtitle}</p>
              ) : (
                <div className="mt-1.5 lg:hidden">{subtitle}</div>
              )
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className={`flex w-full shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end lg:order-2 lg:flex-nowrap ${tabs ? '' : 'lg:ml-auto'}`}>
            {actions}
          </div>
        ) : null}

        {tabs ? (
          <div className="min-w-0 sm:basis-full lg:order-1 lg:ml-auto lg:basis-auto lg:overflow-x-auto">
            {tabs}
          </div>
        ) : null}
      </div>
    </header>
  );
}
