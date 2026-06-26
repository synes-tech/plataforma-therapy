import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingButton } from '@containers/loading';
import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';
import { StandardModal } from '@shared/ui/StandardModal';
import { callFunction } from '@shared/lib/api';
import {
  buildSessionApprovalToast,
  formatSessionNoteForEditing,
  type SessionNoteSoapContent,
} from './session-note-format.utils';
import { SessionNoteFamilyShareModal, type SessionNoteFamilyShareMode } from './SessionNoteFamilyShareModal';
import { SessionNoteSaveVisibilityModal } from './SessionNoteSaveVisibilityModal';

interface SessionNoteApprovalEditorProps {
  noteId: string;
  patientId: string;
  scheduleId?: string;
  content: SessionNoteSoapContent;
  createdAt: string;
  aiGenerated?: boolean;
  highlighted?: boolean;
  onApproved?: (shared: boolean) => void;
  onRejected?: () => void;
}

type ApprovePayload =
  | { compartilhar_familia: false }
  | {
      compartilhar_familia: true;
      share_mode: SessionNoteFamilyShareMode;
      family_text?: string;
    };

export function SessionNoteApprovalEditor({
  noteId,
  patientId,
  scheduleId,
  content,
  createdAt,
  aiGenerated = false,
  highlighted = false,
  onApproved,
  onRejected,
}: SessionNoteApprovalEditorProps) {
  const queryClient = useQueryClient();
  const reportText = useMemo(() => formatSessionNoteForEditing(content), [content]);
  const [visibilityModalOpen, setVisibilityModalOpen] = useState(false);
  const [familyShareModalOpen, setFamilyShareModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [lastShareMode, setLastShareMode] = useState<SessionNoteFamilyShareMode | null>(null);

  const approveMutation = useMutation({
    mutationFn: (payload: ApprovePayload) =>
      callFunction<{
        id: string;
        visivel_familia: boolean;
        share_mode?: SessionNoteFamilyShareMode | null;
        message: string;
      }>('approve-session-note', {
        session_note_id: noteId,
        ...(scheduleId ? { schedule_id: scheduleId } : {}),
        ...payload,
      }),
    onSuccess: (data) => {
      setVisibilityModalOpen(false);
      setFamilyShareModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['session-notes-draft', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['patient-sessions', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
      void queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['latest-agreements'] });
      void queryClient.invalidateQueries({ queryKey: ['family-shared-artifacts'] });
      onApproved?.(data.visivel_familia);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      callFunction<{ id: string; message: string }>('reject-session-note', {
        session_note_id: noteId,
        patient_id: patientId,
      }),
    onSuccess: () => {
      setRejectModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['session-notes-draft', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['patient-sessions', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
      onRejected?.();
    },
  });

  const isBusy = approveMutation.isPending || rejectMutation.isPending;
  const canSave = reportText.trim().length >= 10 && !isBusy;
  const dateLabel = new Date(createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  function handleSavePrivate() {
    approveMutation.mutate({ compartilhar_familia: false });
  }

  function handleFamilyShareConfirm(mode: SessionNoteFamilyShareMode, refinedText?: string) {
    setLastShareMode(mode);
    approveMutation.mutate({
      compartilhar_familia: true,
      share_mode: mode,
      ...(mode === 'refined' && refinedText ? { family_text: refinedText } : {}),
    });
  }

  return (
    <>
      <article
        className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
          highlighted ? 'border-primary/40 ring-2 ring-primary/20' : 'border-slate-100'
        }`}
      >
        <header className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {aiGenerated && (
              <span className="inline-flex rounded-full bg-ai-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ai">
                IA
              </span>
            )}
            <time className="text-xs text-charcoal-muted" dateTime={createdAt}>
              {dateLabel}
            </time>
          </div>
          <p className="mt-2 text-sm text-charcoal-muted">
            Relatório gerado após a sessão. Ao salvar, a versão clínica completa fica no prontuário; você
            decide se e como compartilhar com a família.
          </p>
        </header>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
              Relatório clínico
            </p>
            <div className="mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-[#F8FAF9] px-4 py-3">
              <AiMarkdownContent content={reportText} variant="light" />
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <LoadingButton
            type="button"
            variant="danger"
            fullWidth
            loading={rejectMutation.isPending}
            loadingLabel="Removendo..."
            disabled={approveMutation.isPending}
            onClick={() => setRejectModalOpen(true)}
            className="h-11 text-sm font-semibold sm:w-auto sm:min-w-[180px]"
          >
            Reprovar e apagar
          </LoadingButton>

          <LoadingButton
            type="button"
            variant="primary"
            fullWidth
            loading={approveMutation.isPending}
            loadingLabel="Salvando..."
            disabled={!canSave}
            onClick={() => setVisibilityModalOpen(true)}
            className="h-11 text-sm font-semibold sm:w-auto sm:min-w-[140px]"
          >
            Salvar
          </LoadingButton>
        </footer>

        {rejectMutation.isSuccess && (
          <p className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-charcoal-muted sm:px-5" role="status">
            Relatório reprovado e removido da fila de aprovação.
          </p>
        )}

        {rejectMutation.isError && (
          <p className="border-t border-error/15 bg-error-light/50 px-4 py-3 text-sm text-error sm:px-5" role="alert">
            {rejectMutation.error instanceof Error
              ? rejectMutation.error.message
              : 'Não foi possível reprovar o relatório'}
          </p>
        )}

        {approveMutation.isSuccess && (
          <p className="border-t border-mint/20 bg-mint-50/60 px-4 py-3 text-sm text-mint-dark sm:px-5" role="status">
            {buildSessionApprovalToast(
              approveMutation.data?.visivel_familia ?? false,
              approveMutation.data?.share_mode ?? lastShareMode,
            )}
          </p>
        )}

        {approveMutation.isError && (
          <p className="border-t border-error/15 bg-error-light/50 px-4 py-3 text-sm text-error sm:px-5" role="alert">
            {approveMutation.error instanceof Error
              ? approveMutation.error.message
              : 'Não foi possível salvar o relatório'}
          </p>
        )}
      </article>

      <SessionNoteSaveVisibilityModal
        isOpen={visibilityModalOpen}
        isSaving={isBusy}
        onClose={() => setVisibilityModalOpen(false)}
        onSavePrivate={handleSavePrivate}
        onShareWithFamily={() => {
          setVisibilityModalOpen(false);
          setFamilyShareModalOpen(true);
        }}
      />

      <SessionNoteFamilyShareModal
        isOpen={familyShareModalOpen}
        reportPreview={reportText}
        isSaving={isBusy}
        onClose={() => setFamilyShareModalOpen(false)}
        onConfirm={handleFamilyShareConfirm}
      />

      <StandardModal
        isOpen={rejectModalOpen}
        onClose={() => {
          if (!rejectMutation.isPending) setRejectModalOpen(false);
        }}
        title="Reprovar e apagar relatório?"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              disabled={rejectMutation.isPending}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
            >
              Cancelar
            </button>
            <LoadingButton
              type="button"
              variant="danger"
              loading={rejectMutation.isPending}
              loadingLabel="Apagando..."
              onClick={() => rejectMutation.mutate()}
              className="h-11 sm:w-auto"
            >
              Reprovar e apagar
            </LoadingButton>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-charcoal-muted">
            Este relatório ainda está pendente de aprovação. Ao reprovar, ele será removido permanentemente
            da fila e não entrará no prontuário clínico.
          </p>
          <p className="rounded-xl border border-error/15 bg-error-light/40 px-3 py-2.5 text-xs leading-relaxed text-error">
            Esta ação não pode ser desfeita. Sessão registrada em {dateLabel}.
          </p>
        </div>
      </StandardModal>
    </>
  );
}
