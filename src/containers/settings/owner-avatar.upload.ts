import { callFunction } from '@shared/lib/api';
import { validatePatientAvatarFile } from '@containers/patient/patient-avatar.validation';

interface InitiateResponse {
  upload_url: string;
  storage_path: string;
}

interface ConfirmResponse {
  storage_path: string;
  foto_url: string;
}

export async function uploadOwnerAvatarFile(file: File): Promise<string> {
  const validation = validatePatientAvatarFile(file);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const init = await callFunction<InitiateResponse>('upload-professional-avatar', {
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

  const confirmed = await callFunction<ConfirmResponse>('upload-professional-avatar', {
    action: 'confirm',
    storage_path: init.storage_path,
  });

  return confirmed.foto_url;
}
