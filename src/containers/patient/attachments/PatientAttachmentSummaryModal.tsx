import { StandardModal } from '@shared/ui/StandardModal';
import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';
import { Spinner } from '@containers/loading';

interface PatientAttachmentSummaryModalProps {
  isOpen: boolean;
  fileName: string | null;
  summary: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export function PatientAttachmentSummaryModal({
  isOpen,
  fileName,
  summary,
  loading,
  error,
  onClose,
}: PatientAttachmentSummaryModalProps) {
  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Resumo do documento"
      size="lg"
    >
      {fileName && (
        <p className="mb-4 truncate text-sm text-charcoal-muted">{fileName}</p>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-sm font-medium text-charcoal">Gerando resumo com IA…</p>
          <p className="mt-1 text-xs text-charcoal-muted">Analisando o conteúdo do anexo</p>
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error"
        >
          {error}
        </div>
      )}

      {!loading && !error && summary && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-primary">
            Resumo clínico · IA
          </p>
          <AiMarkdownContent content={summary} />
        </div>
      )}
    </StandardModal>
  );
}
