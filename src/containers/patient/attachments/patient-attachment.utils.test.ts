/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  attachmentStatusLabel,
  formatAttachmentSize,
  validatePatientAttachmentFile,
} from './patient-attachment.utils';
import { MAX_ATTACHMENT_SIZE_BYTES } from './patient-attachment.types';

describe('patient-attachment.utils', () => {
  it('valida tamanho e mime type', () => {
    const file = new File(['conteudo'], 'laudo.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 1024 });
    expect(validatePatientAttachmentFile(file).valid).toBe(true);
  });

  it('rejeita arquivo acima de 15 MB', () => {
    const file = new File(['x'], 'grande.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: MAX_ATTACHMENT_SIZE_BYTES + 1 });
    expect(validatePatientAttachmentFile(file).valid).toBe(false);
  });

  it('rejeita mime não suportado', () => {
    const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 100 });
    expect(validatePatientAttachmentFile(file).valid).toBe(false);
  });

  it('formata tamanho e status', () => {
    expect(formatAttachmentSize(2048)).toContain('KB');
    expect(attachmentStatusLabel('ready')).toBe('Pronto');
  });
});
