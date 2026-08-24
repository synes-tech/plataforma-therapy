/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { sessionWorkspacePath } from './session-workspace.utils';

describe('sessionWorkspacePath', () => {
  it('abre o gate sem paciente', () => {
    expect(sessionWorkspacePath()).toBe('/session');
  });

  it('trava o contexto no paciente', () => {
    expect(sessionWorkspacePath('abc')).toBe('/session/abc');
  });

  it('preserva o agendamento da agenda', () => {
    expect(sessionWorkspacePath('abc', 'sch-1')).toBe('/session/abc?scheduleId=sch-1');
  });
});
