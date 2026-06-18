import { useState } from 'react';
import { SessionAudioPlayer } from './SessionAudioPlayer';
import { exportSessionSummaryPdf } from './exportSessionSummaryPdf';
import {
  formatSessionDate,
  soapToSummaryMarkdown,
} from './session-history.utils';
import {
  SESSION_STATUS_LABEL,
  type PatientSessionRecord,
} from './session-history.types';

interface SessionHistoryItemProps {
  session: PatientSessionRecord;
  patientName: string;
  defaultExpanded?: boolean;
}

export function SessionHistoryItem({
  session,
  patientName,
  defaultExpanded = false,
}: SessionHistoryItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const summaryMarkdown = soapToSummaryMarkdown(session.resumo_ia);
  const transcription =
    session.transcricao_completa?.trim() ||
    session.resumo_ia.transcription?.trim() ||
    '';

  const statusLabel = SESSION_STATUS_LABEL[session.status_nota] ?? session.status_nota;

  async function handleExportPdf() {
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

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50/80"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <time className="block text-sm font-medium text-charcoal">
            {formatSessionDate(session.data_sessao)}
          </time>
          <p className="mt-1 line-clamp-2 text-xs text-charcoal-muted">
            {session.resumo_ia.subjective || 'Sessão registrada'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
              session.status_nota === 'approved'
                ? 'bg-emerald-50 text-emerald-700'
                : session.status_nota === 'draft'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-charcoal-muted'
            }`}
          >
            {statusLabel}
          </span>
          <svg
            className={`h-4 w-4 text-charcoal-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="space-y-5 border-t border-slate-100 px-5 py-5">
          {session.audio_url && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
                Gravação da sessão
              </h4>
              <SessionAudioPlayer
                storagePath={session.audio_url}
                mimeType={session.audio_mime_type}
                durationSeconds={session.audio_duracao_segundos}
              />
            </section>
          )}

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
              Resumo da IA
            </h4>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
              <MarkdownSummary content={summaryMarkdown} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleExportPdf()}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10 disabled:opacity-50"
              >
                {exporting ? (
                  <span className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
                ) : (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                  </svg>
                )}
                Exportar Resumo (PDF)
              </button>
              {exportError && (
                <span className="text-xs text-error">{exportError}</span>
              )}
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
              Transcrição integral
            </h4>
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
      )}
    </article>
  );
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
