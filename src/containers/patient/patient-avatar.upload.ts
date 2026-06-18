import { callFunction } from '@shared/lib/api';
import { validatePatientAvatarFile } from './patient-avatar.validation';

interface InitiateResponse {
  upload_url: string;
  storage_path: string;
}

interface ConfirmResponse {
  storage_path: string;
  foto_url: string;
}

export async function uploadPatientAvatarFile(
  patientId: string,
  file: File,
): Promise<string> {
  const validation = validatePatientAvatarFile(file);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const init = await callFunction<InitiateResponse>('upload-patient-avatar', {
    patient_id: patientId,
    action: 'initiate',
    mime_type: file.type,
    file_size_bytes: file.size,
  });

  if (!init.upload_url) {
    throw new Error('Não foi possível iniciar o upload da foto.');
  }

  const uploadRes = await fetch(init.upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  if (!uploadRes.ok) {
    throw new Error('Falha ao enviar a imagem. Tente novamente.');
  }

  const confirmed = await callFunction<ConfirmResponse>('upload-patient-avatar', {
    patient_id: patientId,
    action: 'confirm',
    storage_path: init.storage_path,
  });

  return confirmed.foto_url;
}
