import { useState } from 'react';

interface Props {
  patientId: string;
  patientName: string;
  className?: string;
  variant?: 'default' | 'compact';
}

export function ExportPdfButton({ patientId, patientName, className = '', variant = 'default' }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { exportPatientPdf } = await import('./exportPatientPdf');
      await exportPatientPdf(patientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar PDF.');
    } finally {
      setLoading(false);
    }
  }

  const isCompact = variant === 'compact';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        aria-busy={loading}
        aria-label={`Exportar PDF do prontuário de ${patientName}`}
        title="Exportar PDF"
        className={
          isCompact
            ? 'inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-charcoal transition-colors hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
            : 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-charcoal transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50'
        }
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            {!isCompact && 'Gerando PDF...'}
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {isCompact ? 'PDF' : 'Exportar PDF'}
          </>
        )}
      </button>
      {error && (
        <p className="mt-1.5 text-[11px] text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
