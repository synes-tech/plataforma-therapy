import type { ReactNode } from 'react';

type EmptyVariant = 'sessions' | 'diary' | 'recommendations' | 'saved-history' | 'summary';

interface RecordEmptyStateProps {
  variant: EmptyVariant;
  action?: ReactNode;
  className?: string;
}

const COPY: Record<EmptyVariant, { title: string; description: string }> = {
  sessions: {
    title: 'Nenhuma sessão registrada',
    description: 'Grave uma sessão para iniciar o histórico clínico deste paciente.',
  },
  diary: {
    title: 'Diário familiar vazio',
    description: 'Não há entradas nos últimos 14 dias. Convide a família para acompanhar o dia a dia.',
  },
  recommendations: {
    title: 'Aguardando sua solicitação',
    description: 'Escolha as fontes clínicas e deixe a IA sugerir ações para a próxima sessão.',
  },
  'saved-history': {
    title: 'Nenhuma recomendação salva',
    description: 'Você ainda não salvou nenhuma recomendação gerada pela IA.',
  },
  summary: {
    title: 'Resumo ainda indisponível',
    description: 'Registre a primeira sessão ou aguarde entradas no diário familiar.',
  },
};

function EmptyIcon({ variant }: { variant: EmptyVariant }) {
  if (variant === 'recommendations' || variant === 'saved-history' || variant === 'summary') {
    return (
      <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    );
  }
  if (variant === 'diary') {
    return (
      <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    );
  }
  return (
    <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

export function RecordEmptyState({ variant, action, className = '' }: RecordEmptyStateProps) {
  const { title, description } = COPY[variant];

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-transparent px-4 py-10 text-center sm:px-6 ${className}`}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
        <EmptyIcon variant={variant} />
      </div>
      <p className="text-sm font-medium text-charcoal-muted">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-charcoal-muted/70">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
