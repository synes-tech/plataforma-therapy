import { describe, expect, it } from 'vitest';
import {
  buildSessionApprovalToast,
  formatSessionNoteForEditing,
} from './session-note-format.utils';

describe('formatSessionNoteForEditing', () => {
  it('prioriza lapidated_text quando existir', () => {
    expect(
      formatSessionNoteForEditing({
        lapidated_text: 'Texto lapidado pelo terapeuta',
        patient_reports: 'Original',
      }),
    ).toBe('Texto lapidado pelo terapeuta');
  });

  it('monta seções do prontuário psicológico (com fallback legado SOAP)', () => {
    const text = formatSessionNoteForEditing({
      subjective: 'Relato da mãe',
      plan: 'Praticar respiração',
    });

    expect(text).toContain('Relatos e Conteúdo Trazido');
    expect(text).toContain('Relato da mãe');
    expect(text).toContain('Manejo e Próximos Passos');
    expect(text).toContain('Praticar respiração');
  });
});

describe('buildSessionApprovalToast', () => {
  it('diferencia mensagens privado vs família', () => {
    expect(buildSessionApprovalToast(false)).toContain('Documentos salvos');
    expect(buildSessionApprovalToast(true, 'as_is')).toContain('Documentos salvos');
    expect(buildSessionApprovalToast(true, 'refined')).toContain('Documentos salvos');
  });
});

describe('clinical_raw_text', () => {
  it('prioriza clinical_raw_text sobre lapidated_text', () => {
    expect(
      formatSessionNoteForEditing({
        clinical_raw_text: 'Versão bruta clínica',
        lapidated_text: 'Texto lapidado',
      }),
    ).toBe('Versão bruta clínica');
  });
});
