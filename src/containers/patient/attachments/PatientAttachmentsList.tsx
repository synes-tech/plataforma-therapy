import type { PatientAttachment } from './patient-attachment.types';
import {
  attachmentStatusLabel,
  formatAttachmentSize,
} from './patient-attachment.utils';

interface PatientAttachmentsListProps {
  items: PatientAttachment[];
  uploadingNames?: string[];
  onDelete?: (attachmentId: string) => void;
  onViewSummary?: (item: PatientAttachment) => void;
  summaryLoadingId?: string | null;
  deletingId?: string | null;
  compact?: boolean;
}

function statusBadgeClass(status: PatientAttachment['status']): string {
  switch (status) {
    case 'ready':
      return 'bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'bg-error-light text-error';
    case 'processing':
    case 'uploading':
      return 'bg-amber-50 text-amber-800';
    default:
      return 'bg-slate-100 text-charcoal-muted';
  }
}

export function PatientAttachmentsList({
  items,
  uploadingNames = [],
  onDelete,
  onViewSummary,
  summaryLoadingId,
  deletingId,
  compact = false,
}: PatientAttachmentsListProps) {
  const hasRows = items.length > 0 || uploadingNames.length > 0;
  if (!hasRows) return null;

  return (
    <div className={`space-y-2 ${compact ? '' : 'mt-4'}`}>
      {uploadingNames.map((name) => (
        <div
          key={`uploading-${name}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-charcoal">{name}</p>
            <p className="text-xs text-charcoal-muted">Enviando e vetorizando...</p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            Processando
          </span>
        </div>
      ))}

      {items.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium text-charcoal">{item.file_name}</p>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass(item.status)}`}
              >
                {attachmentStatusLabel(item.status)}
              </span>
            </div>
            <p className="mt-1 text-xs text-charcoal-muted">
              {formatAttachmentSize(item.file_size_bytes)}
              {item.status === 'ready' && item.embeddings_count > 0
                ? ` · ${item.embeddings_count} trechos na base IA`
                : ''}
              {item.status === 'failed' && item.processing_error
                ? ` · ${item.processing_error}`
                : ''}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {item.status === 'ready' && onViewSummary && (
              <button
                type="button"
                onClick={() => onViewSummary(item)}
                disabled={summaryLoadingId === item.id}
                className="inline-flex min-h-10 items-center rounded-xl border border-primary/25 bg-primary/5 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60"
              >
                {summaryLoadingId === item.id ? 'Carregando…' : 'Ver resumo'}
              </button>
            )}
            {item.download_url && (
              <a
                href={item.download_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-xs font-medium text-charcoal transition-colors hover:bg-slate-50"
              >
                Abrir
              </a>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                disabled={deletingId === item.id}
                className="inline-flex min-h-10 items-center rounded-xl border border-error/20 px-3 text-xs font-medium text-error transition-colors hover:bg-error-light/40 disabled:opacity-50"
              >
                {deletingId === item.id ? 'Removendo...' : 'Remover'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
