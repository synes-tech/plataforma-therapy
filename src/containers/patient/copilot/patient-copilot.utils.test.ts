/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { buildConversationHistory } from './patient-copilot.utils';
import type { CopilotMessage } from './patient-copilot.types';

describe('patient-copilot.utils', () => {
  it('monta histórico user/assistant excluindo streaming vazio', () => {
    const messages: CopilotMessage[] = [
      { id: '1', role: 'user', content: 'Olá' },
      { id: '2', role: 'assistant', content: 'Resposta completa' },
      { id: '3', role: 'user', content: 'Segunda pergunta' },
      { id: '4', role: 'assistant', content: '', streaming: true },
    ];

    expect(buildConversationHistory(messages)).toEqual([
      { role: 'user', content: 'Olá' },
      { role: 'assistant', content: 'Resposta completa' },
      { role: 'user', content: 'Segunda pergunta' },
    ]);
  });
});
