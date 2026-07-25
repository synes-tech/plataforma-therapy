import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
} from './patient-attachment.types';

export interface AttachmentValidationResult {
  valid: boolean;
  message?: string;
}

export function validatePatientAttachmentFile(file: File): AttachmentValidationResult {
  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number])) {
    return {
      valid: false,
      message: 'Formato não suportado. Envie PDF, Word (.doc/.docx) ou TXT.',
    };
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return { valid: false, message: 'O arquivo deve ter no máximo 15 MB.' };
  }

  if (file.size <= 0) {
    return { valid: false, message: 'Arquivo vazio.' };
  }

  return { valid: true };
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function attachmentStatusLabel(status: string): string {
  switch (status) {
    case 'uploading':
      return 'Enviando';
    case 'processing':
      return 'Processando IA';
    case 'ready':
      return 'Pronto';
    case 'failed':
      return 'Falhou';
    default:
      return status;
  }
}
