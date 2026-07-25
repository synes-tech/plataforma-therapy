export function sanitizeAttachmentFileName(name: string): string {
  const base = name.trim().replace(/[/\\]/g, '_').replace(/\s+/g, '_');
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '');
  return cleaned.slice(0, 120) || 'anexo';
}

export function buildAttachmentStoragePath(
  clinicId: string,
  patientId: string,
  attachmentId: string,
  fileName: string,
): string {
  return `${clinicId}/${patientId}/${attachmentId}/${sanitizeAttachmentFileName(fileName)}`;
}

/** Valida que o path pertence ao paciente/clínica/anexo informados (anti-IDOR no storage). */
export function isValidAttachmentStoragePath(
  storagePath: string,
  clinicId: string,
  patientId: string,
  attachmentId: string,
): boolean {
  const expectedPrefix = `${clinicId}/${patientId}/${attachmentId}/`;
  if (!storagePath.startsWith(expectedPrefix)) return false;
  const remainder = storagePath.slice(expectedPrefix.length);
  if (!remainder || remainder.includes('..') || remainder.includes('/')) return false;
  return sanitizeAttachmentFileName(remainder) === remainder;
}
