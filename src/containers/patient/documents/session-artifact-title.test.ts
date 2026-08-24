import { describe, expect, it } from 'vitest';
import {
  buildSessionReportArtifactTitle,
  buildSessionReportCopyTitle,
} from './session-artifact-title';

describe('título do relatório de sessão salvo', () => {
  it('monta título com data e nome da paciente', () => {
    expect(buildSessionReportArtifactTitle('2026-08-20T15:00:00.000-03:00', 'Beatriz Lima')).toBe(
      'Relatório da sessão de 20/08/2026 — Beatriz Lima',
    );
  });

  it('prefixa cópia uma única vez', () => {
    const original = 'Relatório da sessão de 20/08/2026 — Beatriz Lima';
    expect(buildSessionReportCopyTitle(original)).toBe(`Cópia — ${original}`);
    expect(buildSessionReportCopyTitle(`Cópia — ${original}`)).toBe(`Cópia — ${original}`);
  });
});
