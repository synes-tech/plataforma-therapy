import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { InlineLoadingButton } from '@containers/loading';
import { SessionAudioPlayer } from '../session/SessionAudioPlayer';
import { exportSessionSummaryPdf } from '../session/exportSessionSummaryPdf';
import {
  formatSessionDate,
  soapToSummaryMarkdown,
} from '../session/session-history.utils';
import type { PatientSessionRecord } from '../session/session-history.types';
import {
  buildSessionTitle,
  deriveSessionReportBadge,
  formatSessionDateShort,
} from './patient-sessions.format';

interface PatientSessionReadModalProps {
  session: PatientSessionRecord | null;
  patientName: string;
  onClose: () => void;
}

function MarkdownSummary({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-2 text-sm leading-relaxed text-charcoal">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;
        if (trimmed.startsWith('## ')) {
          return (
            <h5 key={idx} className="pt-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {trimmed.replace(/^##\s+/, '')}
            </h5>
          );
        }
        return <p key={idx}>{trimmed}</p>;
      })}
    </div>
  );
}

export function PatientSessionReadModal({
  session,
  patientName,
  onClose,
}: PatientSessionReadModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const isOpen = session !== null;

  const summaryMarkdown = session ? soapToSummaryMarkdown(session.resumo_ia) : '';
  const transcription =
    session?.transcricao_completa?.trim() ||
    session?.resumo_ia.transcription?.trim() ||
    '';
  const badge = session ? deriveSessionReportBadge(session) : null;

  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  async function handleExportPdf() {
    if (!session) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportSessionSummaryPdf(session, patientName);
    } catch {
      setExportError('Não foi possível gerar o PDF.');
    } finally {
      setExporting(false);
    }
  }

  if (!isOpen || !session || !badge) return null;

  const title = buildSessionTitle(session.data_sessao);
  const dateLabel = formatSessionDate(session.data_sessao);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in bg-slate-900/45 p-2 backdrop-blur-sm sm:p-3 md:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full animate-scale-in flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
      >
        <header className="flex shrink-0 flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="font-serif text-lg font-medium tracking-tight text-charcoal md:text-xl"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-charcoal-muted">{dateLabel}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.className}`}
              >
                {badge.label}
              </span>
              <span className="text-xs text-charcoal-muted">
                Registrada em {formatSessionDateShort(session.data_sessao)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-charcoal-muted transition-colors hover:bg-slate-50 hover:text-charcoal"
            aria-label="Fechar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {session.audio_url && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
                Gravação da sessão
              </h3>
              <SessionAudioPlayer
                storagePath={session.audio_url}
                mimeType={session.audio_mime_type}
                durationSeconds={session.audio_duracao_segundos}
              />
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
              Relatório consolidado (IA)
            </h3>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
              <MarkdownSummary content={summaryMarkdown} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <InlineLoadingButton
                type="button"
                onClick={() => void handleExportPdf()}
                loading={exporting}
                className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
              >
                Exportar relatório (PDF)
              </InlineLoadingButton>
              {exportError && <span className="text-xs text-error">{exportError}</span>}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
              Transcrição integral
            </h3>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100 bg-white px-4 py-3">
              {transcription ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-charcoal">
                  {transcription}
                </p>
              ) : (
                <p className="text-sm italic text-charcoal-muted">
                  Transcrição não disponível para esta sessão.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
