import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { InlineLoadingButton, Spinner } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';
import { PremiumMarkdownPdfDocument } from '@containers/pdf/PremiumMarkdownPdfDocument';
import { deliverPdfBlob } from '@containers/pdf/deliverPdfBlob';
import { markdownToPdfBlocks, sanitizeFilename } from '@containers/pdf/pdf-content.utils';
import type { FamilySessionDetailResponse } from './family-session.types';

interface FamilySessionReadModalProps {
  sessionId: string | null;
  patientName: string;
  onClose: () => void;
}

function formatSessionTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatSessionDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function FamilySessionReadModal({
  sessionId,
  patientName,
  onClose,
}: FamilySessionReadModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const isOpen = sessionId !== null;

  const { data, isLoading, error } = useQuery({
    queryKey: ['family-session-detail', sessionId],
    queryFn: () =>
      callFunction<FamilySessionDetailResponse>('get-family-session-detail', {
        session_note_id: sessionId!,
      }),
    enabled: isOpen,
    staleTime: 60_000,
  });

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
    if (!data?.family_report) return;
    setExporting(true);
    setExportError(null);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const blob = await pdf(
        <PremiumMarkdownPdfDocument
          context={{
            professional: {
              name: data.therapist_name,
              email: '',
              phone: null,
              specialty: null,
              crp: null,
            },
            clinic: { name: 'Unithery' },
            generatedAt: new Date().toISOString(),
          }}
          meta={{
            documentTitle: `Relatório de Sessão — ${patientName}`,
            documentSubtitle: 'Material compartilhado pelo terapeuta',
            metaLine: formatSessionDate(data.data_sessao),
            disclaimer: 'Documento compartilhado pelo profissional responsável. Uso informativo para a família.',
          }}
          contentBlocks={markdownToPdfBlocks(data.family_report)}
        />,
      ).toBlob();

      const date = data.data_sessao.slice(0, 10);
      await deliverPdfBlob(blob, `unithery-sessao-${sanitizeFilename(patientName)}-${date}.pdf`, {
        shareTitle: `Relatório de sessão — ${patientName}`,
      });
    } catch {
      setExportError('Não foi possível gerar o PDF.');
    } finally {
      setExporting(false);
    }
  }

  if (!isOpen) return null;

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
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="font-serif text-lg font-medium tracking-tight text-charcoal md:text-xl">
              {data?.session_title ?? 'Sessão'}
            </h2>
            {data ? (
              <p className="mt-1 text-sm capitalize text-charcoal-muted">{formatSessionDate(data.data_sessao)}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-charcoal-muted hover:bg-slate-50"
            aria-label="Fechar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Spinner size="md" />
              <p className="text-sm text-charcoal-muted">Carregando sessão...</p>
            </div>
          ) : error ? (
            <p className="text-sm text-error" role="alert">
              {error instanceof Error ? error.message : 'Erro ao carregar sessão'}
            </p>
          ) : data ? (
            <>
              <dl className="grid gap-3 rounded-xl border border-slate-100 bg-[#F8FAF9] p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-charcoal-muted">Paciente</dt>
                  <dd className="text-sm font-medium text-charcoal">{patientName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-charcoal-muted">Profissional</dt>
                  <dd className="text-sm font-medium text-charcoal">{data.therapist_name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-charcoal-muted">Horário</dt>
                  <dd className="text-sm font-medium text-charcoal">
                    {data.scheduled_time ?? formatSessionTime(data.data_sessao)}
                  </dd>
                </div>
                {data.duration_minutes ? (
                  <div>
                    <dt className="text-xs text-charcoal-muted">Duração</dt>
                    <dd className="text-sm font-medium text-charcoal">{data.duration_minutes} min</dd>
                  </div>
                ) : null}
              </dl>

              {data.report_shared && data.family_report ? (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
                    Relatório da sessão
                  </h3>
                  <div className="max-h-[min(50vh,32rem)] overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                    <AiMarkdownContent content={data.family_report} variant="light" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <InlineLoadingButton
                      type="button"
                      onClick={() => void handleExportPdf()}
                      loading={exporting}
                      className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                    >
                      Exportar PDF
                    </InlineLoadingButton>
                    {exportError ? <span className="text-xs text-error">{exportError}</span> : null}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
