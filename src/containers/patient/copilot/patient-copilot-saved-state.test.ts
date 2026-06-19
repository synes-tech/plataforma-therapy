import { describe, expect, it } from 'vitest';
import { artifactFingerprint, artifactSaveKey } from './patient-copilot-fingerprint';
import {
  buildAssistantSyncKey,
  buildSavedTypesByMessage,
  mergeSavedType,
  removeSavedType,
} from './patient-copilot-saved-state';
import type { CopilotMessage } from './patient-copilot.types';

function assistant(id: string, content: string, streaming = false): CopilotMessage {
  return { id, role: 'assistant', content, streaming };
}

describe('buildAssistantSyncKey', () => {
  it('ignora mensagens em streaming e vazias', () => {
    const messages = [
      assistant('a1', 'Resposta final'),
      assistant('a2', '', true),
      assistant('a3', '   '),
      { id: 'u1', role: 'user' as const, content: 'Oi' },
    ];
    expect(buildAssistantSyncKey(messages)).toBe('a1:14');
  });

  it('muda quando o conteúdo de uma resposta concluída muda', () => {
    const before = [assistant('a1', 'Curto')];
    const after = [assistant('a1', 'Texto mais longo')];
    expect(buildAssistantSyncKey(before)).not.toBe(buildAssistantSyncKey(after));
  });
});

describe('buildSavedTypesByMessage', () => {
  it('marca tipos já salvos usando cache de fingerprint', async () => {
    const content = 'Plano terapêutico sugerido';
    const fingerprint = await artifactFingerprint(content);
    const savedKeys = new Set([
      artifactSaveKey(fingerprint, 'acao_recomendada'),
      artifactSaveKey(fingerprint, 'relatorio_sessao'),
    ]);
    const cache = new Map<string, string>();

    const messages = [assistant('m1', content)];
    const result = await buildSavedTypesByMessage(messages, savedKeys, cache);

    expect(result.m1).toBeDefined();
    expect([...(result.m1 ?? [])]).toEqual(['acao_recomendada', 'relatorio_sessao']);
    expect(cache.get('m1')).toBe(fingerprint);
    expect(cache.get('m1:content')).toBe(content);

    const again = await buildSavedTypesByMessage(messages, savedKeys, cache);
    expect(again).toEqual(result);
  });
});

describe('mergeSavedType / removeSavedType', () => {
  it('adiciona e remove tipo sem mutar sets anteriores', () => {
    const base = { m1: new Set(['acao_recomendada' as const]) };
    const merged = mergeSavedType(base, 'm1', 'resumo_proativo');
    expect([...(merged.m1 ?? [])]).toEqual(['acao_recomendada', 'resumo_proativo']);
    expect(base.m1).toEqual(new Set(['acao_recomendada']));

    const removed = removeSavedType(merged, 'm1', 'acao_recomendada');
    expect([...(removed.m1 ?? [])]).toEqual(['resumo_proativo']);
  });
});
