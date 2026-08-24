/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { filterWorkspacePatients, workspacePatientAgeLabel } from './copilot-workspace.utils';
import { mapPersistedCopilotMessages } from '@containers/patient/copilot/patient-copilot.utils';
import { workspaceSurfaceAddendum } from '@containers/patient/copilot/patient-copilot-context.utils';

const patients = [
  { id: '1', name: 'Ana Souza', diagnoses: ['TEA'] },
  { id: '2', name: 'Bruno Lima', diagnoses: ['TDAH'] },
];

describe('filterWorkspacePatients', () => {
  it('não lista ninguém enquanto a busca está vazia', () => {
    expect(filterWorkspacePatients(patients, '  ')).toEqual([]);
  });

  it('filtra por nome', () => {
    expect(filterWorkspacePatients(patients, 'ana').map((p) => p.id)).toEqual(['1']);
  });

  it('filtra por diagnóstico', () => {
    expect(filterWorkspacePatients(patients, 'tdah').map((p) => p.id)).toEqual(['2']);
  });
});

describe('workspacePatientAgeLabel', () => {
  it('retorna nulo para data inválida', () => {
    expect(workspacePatientAgeLabel('nao-e-data')).toBeNull();
    expect(workspacePatientAgeLabel(null)).toBeNull();
  });
});

describe('mapPersistedCopilotMessages', () => {
  it('ignora vazios e hidrata o chat', () => {
    expect(mapPersistedCopilotMessages([
      { id: 'a', role: 'user', content: '  ' },
      { id: 'b', role: 'user', content: 'Como está o sono?' },
      { id: 'c', role: 'assistant', content: 'Conforme o diário...' },
    ])).toEqual([
      { id: 'b', role: 'user', content: 'Como está o sono?', inputSource: undefined, sources: undefined, guardrail_triggered: undefined, answer_incomplete: undefined },
      { id: 'c', role: 'assistant', content: 'Conforme o diário...', inputSource: undefined, sources: undefined, guardrail_triggered: undefined, answer_incomplete: undefined },
    ]);
  });
});

describe('workspaceSurfaceAddendum', () => {
  it('trava o contexto no paciente escolhido', () => {
    const addendum = workspaceSurfaceAddendum('Ana Souza');
    expect(addendum).toContain('Ana Souza');
    expect(addendum).toContain('TRAVADO');
    expect(addendum).toContain('Nunca peça outro paciente');
  });
});
