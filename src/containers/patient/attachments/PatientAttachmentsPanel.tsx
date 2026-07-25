import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingOverlay } from '@containers/loading';
import { Toast } from '../Toast';
import { PatientAttachmentDropzone } from './PatientAttachmentDropzone';
import { PatientAttachmentsList } from './PatientAttachmentsList';
import { PatientAttachmentSummaryModal } from './PatientAttachmentSummaryModal';
import type { PatientAttachment } from './patient-attachment.types';
import {
  deletePatientAttachment,
  fetchPatientAttachmentSummary,
  fetchPatientAttachments,
  uploadPatientAttachmentFile,
} from './patient-attachment.api';

interface PatientAttachmentsPanelProps {
  patientId: string;
  title?: string;
  description?: string;
  showHeader?: boolean;
}

export function PatientAttachmentsPanel({
  patientId,
  title = 'Anexos e base de conhecimento',
  description = 'Laudos, relatórios escolares e exames enviados pelo terapeuta. Cada arquivo é processado e injetado no Copiloto IA deste paciente.',
  showHeader = true,
}: PatientAttachmentsPanelProps) {
  const queryClient = useQueryClient();
  const [uploadingNames, setUploadingNames] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryFileName, setSummaryFileName] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryLoadingId, setSummaryLoadingId] = useState<string | null>(null);

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['patient-attachments', patientId],
    queryFn: () => fetchPatientAttachments(patientId),
    enabled: !!patientId,
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => deletePatientAttachment(patientId, attachmentId),
    onSuccess: () => {
      setToast({ message: 'Anexo removido da ficha e da base IA', variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['patient-attachments', patientId] });
    },
    onError: (err: Error) => {
      setToast({ message: err.message || 'Não foi possível remover o anexo', variant: 'error' });
    },
  });

  async function handleUpload(files: File[]) {
    for (const file of files) {
      setUploadingNames((current) => [...current, file.name]);
      try {
        await uploadPatientAttachmentFile(patientId, file);
        setToast({
          message: `"${file.name}" adicionado à base de conhecimento da IA`,
          variant: 'success',
        });
        void queryClient.invalidateQueries({ queryKey: ['patient-attachments', patientId] });
      } catch (err) {
        setToast({
          message: err instanceof Error ? err.message : `Falha ao enviar ${file.name}`,
          variant: 'error',
        });
      } finally {
        setUploadingNames((current) => current.filter((name) => name !== file.name));
      }
    }
  }

  async function handleViewSummary(item: PatientAttachment) {
    setSummaryModalOpen(true);
    setSummaryFileName(item.file_name);
    setSummaryError(null);
    setSummaryLoadingId(item.id);

    if (item.ai_summary?.trim()) {
      setSummaryText(item.ai_summary);
      setSummaryLoading(false);
      setSummaryLoadingId(null);
      return;
    }

    setSummaryText(null);
    setSummaryLoading(true);

    try {
      const result = await fetchPatientAttachmentSummary(patientId, item.id);
      setSummaryText(result.ai_summary);
      void queryClient.invalidateQueries({ queryKey: ['patient-attachments', patientId] });
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Não foi possível gerar o resumo.');
    } finally {
      setSummaryLoading(false);
      setSummaryLoadingId(null);
    }
  }

  function closeSummaryModal() {
    setSummaryModalOpen(false);
    setSummaryFileName(null);
    setSummaryText(null);
    setSummaryError(null);
    setSummaryLoading(false);
    setSummaryLoadingId(null);
  }

  const items = data?.items ?? [];
  const isUploading = uploadingNames.length > 0;

  return (
    <div className="relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <LoadingOverlay
        show={isUploading || (!!data && isFetching)}
        label={isUploading ? 'Enviando e vetorizando anexo...' : 'Atualizando anexos...'}
      />

      {showHeader && (
        <div className="mb-4">
          <h3 className="text-base font-semibold text-charcoal">{title}</h3>
          <p className="mt-1 text-sm text-charcoal-muted">{description}</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-error/15 bg-error-light/40 px-4 py-3 text-sm text-error"
        >
          <p>Não foi possível carregar os anexos.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 text-xs font-medium underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <PatientAttachmentDropzone
        disabled={isUploading || isPending}
        onFilesSelected={(files) => void handleUpload(files)}
      />

      <PatientAttachmentsList
        items={items}
        uploadingNames={uploadingNames}
        onDelete={(attachmentId) => deleteMutation.mutate(attachmentId)}
        onViewSummary={(item) => void handleViewSummary(item)}
        summaryLoadingId={summaryLoadingId}
        deletingId={deleteMutation.isPending ? deleteMutation.variables ?? null : null}
      />

      {!isPending && !error && items.length === 0 && uploadingNames.length === 0 && (
        <p className="mt-3 text-xs text-charcoal-muted/70">
          Nenhum anexo enviado ainda. Adicione laudos ou relatórios para enriquecer o Copiloto.
        </p>
      )}

      <PatientAttachmentSummaryModal
        isOpen={summaryModalOpen}
        fileName={summaryFileName}
        summary={summaryText}
        loading={summaryLoading}
        error={summaryError}
        onClose={closeSummaryModal}
      />

      <Toast
        message={toast?.message ?? ''}
        visible={toast !== null}
        variant={toast?.variant ?? 'success'}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}
