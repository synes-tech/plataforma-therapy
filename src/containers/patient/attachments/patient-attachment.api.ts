import { callFunction } from '@shared/lib/api';
import type { PatientAttachment, PatientAttachmentsResponse } from './patient-attachment.types';
import { validatePatientAttachmentFile } from './patient-attachment.utils';

interface InitiateResponse {
  attachment_id: string;
  upload_url: string;
  storage_path: string;
}

interface ConfirmResponse {
  storage_path: string;
  attachment: PatientAttachment;
}

export async function uploadPatientAttachmentFile(
  patientId: string,
  file: File,
  description?: string,
): Promise<PatientAttachment> {
  const validation = validatePatientAttachmentFile(file);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const init = await callFunction<InitiateResponse>('upload-patient-attachment', {
    action: 'initiate',
    patient_id: patientId,
    file_name: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
    description: description?.trim() || undefined,
  });

  if (!init.upload_url || !init.attachment_id) {
    throw new Error('Não foi possível iniciar o upload do anexo.');
  }

  const uploadRes = await fetch(init.upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  if (!uploadRes.ok) {
    throw new Error('Falha ao enviar o arquivo. Tente novamente.');
  }

  const confirmed = await callFunction<ConfirmResponse>('upload-patient-attachment', {
    action: 'confirm',
    patient_id: patientId,
    attachment_id: init.attachment_id,
    storage_path: init.storage_path,
    file_name: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
    description: description?.trim() || undefined,
  });

  return confirmed.attachment;
}

export async function fetchPatientAttachmentSummary(
  patientId: string,
  attachmentId: string,
): Promise<{ ai_summary: string; file_name: string }> {
  return callFunction('get-patient-attachment-summary', {
    patient_id: patientId,
    attachment_id: attachmentId,
  });
}

export async function fetchPatientAttachments(patientId: string): Promise<PatientAttachmentsResponse> {
  return callFunction<PatientAttachmentsResponse>('list-patient-attachments', {
    patient_id: patientId,
  });
}

export async function deletePatientAttachment(patientId: string, attachmentId: string): Promise<void> {
  await callFunction('delete-patient-attachment', {
    patient_id: patientId,
    attachment_id: attachmentId,
  });
}
