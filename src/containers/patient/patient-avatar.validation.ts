export const PATIENT_AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const PATIENT_AVATAR_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type PatientAvatarValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export function validatePatientAvatarFile(file: File): PatientAvatarValidationResult {
  if (!PATIENT_AVATAR_ALLOWED_TYPES.includes(file.type as typeof PATIENT_AVATAR_ALLOWED_TYPES[number])) {
    return {
      valid: false,
      message: 'Use uma imagem PNG, JPG ou WebP.',
    };
  }

  if (file.size > PATIENT_AVATAR_MAX_BYTES) {
    return {
      valid: false,
      message: 'A imagem deve ter no máximo 5 MB.',
    };
  }

  return { valid: true };
}
