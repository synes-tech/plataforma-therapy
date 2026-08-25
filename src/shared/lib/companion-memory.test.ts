/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  extractCompanionSessionReport,
  formatCompanionMemoryBlock,
  type CompanionMemory,
} from '../../../supabase/functions/_shared/companion/companion-memory.ts';
import { buildTherySystemInstruction } from '../../../supabase/functions/_shared/companion/thery-prompt.ts';

function memory(partial: Partial<CompanionMemory> = {}): CompanionMemory {
  return {
    patient: partial.patient ?? null,
    diaries: partial.diaries ?? [],
    sessions: partial.sessions ?? [],
  };
}

describe('memória silenciosa da Ivy', () => {
  it('usa queixa e relato da sessão, sem hipótese nem diagnóstico', () => {
    const block = formatCompanionMemoryBlock(
      memory({
        patient: {
          queixa_principal: 'crises de ansiedade no pós-término',
          objetivos_terapeuticos: 'retomar rotina e sono',
          hiperfocos_interesses: null,
          escolaridade_ocupacao: null,
          composicao_familiar: null,
          informacoes_adicionais: null,
        },
        sessions: [
          {
            created_at: '2026-08-20T12:00:00.000Z',
            patient_report: 'Relatou crises de ansiedade após o término.',
          },
        ],
      }),
    );
    expect(block).toContain('crises de ansiedade no pós-término');
    expect(block).toContain('Relatou crises de ansiedade após o término');
    expect(block).toContain('O que já foi trabalhado');
    expect(block).not.toMatch(/diagnóst/i);
    expect(block).not.toMatch(/hipótese/i);
    expect(block).not.toMatch(/medica/i);
  });

  it('ignora hipótese clínica da nota SOAP', () => {
    expect(
      extractCompanionSessionReport({
        patient_reports: 'Estou mal depois do término',
        clinical_observations: 'Hipótese de transtorno de ansiedade generalizada',
        assessment: 'TAG',
        medicamentos: 'sertralina',
      }),
    ).toBe('Estou mal depois do término');
  });

  it('devolve vazio quando não há histórico útil', () => {
    expect(formatCompanionMemoryBlock(memory())).toBe('');
  });

  it('ensina a Ivy a usar a memória sem negar o acompanhamento', () => {
    const prompt = buildTherySystemInstruction({
      firstName: 'João',
      memoryBlock: formatCompanionMemoryBlock(
        memory({
          patient: {
            queixa_principal: 'ansiedade no pós-término',
            objetivos_terapeuticos: null,
            hiperfocos_interesses: null,
            escolaridade_ocupacao: null,
            composicao_familiar: null,
            informacoes_adicionais: null,
          },
        }),
      ),
    });
    expect(prompt).toContain('ansiedade no pós-término');
    expect(prompt).toMatch(/não minta que não conhece o acompanhamento/i);
    expect(prompt).not.toContain('Copiloto Clínico');
  });
});
