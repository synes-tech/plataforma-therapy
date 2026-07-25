/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  buildAttachmentStoragePath,
  isValidAttachmentStoragePath,
  sanitizeAttachmentFileName,
} from '../../../../supabase/functions/_shared/patient-attachment-security.ts';

const CLINIC = '11111111-1111-1111-1111-111111111111';
const PATIENT = '22222222-2222-2222-2222-222222222222';
const ATTACHMENT = '33333333-3333-3333-3333-333333333333';

describe('patient-attachment-security', () => {
  it('sanitiza nomes com path traversal e caracteres inválidos', () => {
    expect(sanitizeAttachmentFileName('../../laudo.pdf')).toBe('.._.._laudo.pdf');
    expect(sanitizeAttachmentFileName('  relatório escolar.pdf  ')).toBe('relatrio_escolar.pdf');
  });

  it('monta path canônico clinic/patient/attachment/file', () => {
    const path = buildAttachmentStoragePath(CLINIC, PATIENT, ATTACHMENT, 'Laudo TEA.pdf');
    expect(path).toBe(`${CLINIC}/${PATIENT}/${ATTACHMENT}/Laudo_TEA.pdf`);
  });

  it('aceita apenas paths que casam com tenant e anexo', () => {
    const valid = buildAttachmentStoragePath(CLINIC, PATIENT, ATTACHMENT, 'exame.pdf');
    expect(isValidAttachmentStoragePath(valid, CLINIC, PATIENT, ATTACHMENT)).toBe(true);
  });

  it('rejeita path de outro paciente (anti-IDOR)', () => {
    const otherPatient = '99999999-9999-9999-9999-999999999999';
    const foreign = buildAttachmentStoragePath(CLINIC, otherPatient, ATTACHMENT, 'exame.pdf');
    expect(isValidAttachmentStoragePath(foreign, CLINIC, PATIENT, ATTACHMENT)).toBe(false);
  });

  it('rejeita path com subpastas ou traversal no nome do arquivo', () => {
    const malicious = `${CLINIC}/${PATIENT}/${ATTACHMENT}/../outro.pdf`;
    expect(isValidAttachmentStoragePath(malicious, CLINIC, PATIENT, ATTACHMENT)).toBe(false);
  });
});
