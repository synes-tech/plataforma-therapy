import { describe, expect, it } from 'vitest';
import {
  THERY_DIALOGUE_BODY_MS,
  THERY_DIALOGUE_GAP_MS,
  THERY_DIALOGUE_TITLE_MS,
  theryDialogueFrame,
} from './thery-dialogue.utils';

describe('theryDialogueFrame', () => {
  it('mostra o texto inteiro no modo instantâneo', () => {
    expect(theryDialogueFrame(0, 'Oi', 'Vamos', true)).toEqual({
      title: 'Oi',
      body: 'Vamos',
      done: true,
      caret: 'body',
    });
  });

  it('mostra o primeiro caractere na hora e avança o título', () => {
    const first = theryDialogueFrame(0, 'Oi!', 'Corpo');
    expect(first.title).toBe('O');
    expect(first.body).toBe('');
    expect(first.done).toBe(false);
    expect(first.caret).toBe('title');

    const second = theryDialogueFrame(THERY_DIALOGUE_TITLE_MS, 'Oi!', 'Corpo');
    expect(second.title).toBe('Oi');
  });

  it('pausa entre título e corpo, depois digita o corpo', () => {
    const afterTitle = 3 * THERY_DIALOGUE_TITLE_MS;
    const pause = theryDialogueFrame(afterTitle + 40, 'Oi!', 'Corpo');
    expect(pause.title).toBe('Oi!');
    expect(pause.body).toBe('');
    expect(pause.caret).toBe('body');

    const typingBody = theryDialogueFrame(afterTitle + THERY_DIALOGUE_GAP_MS + THERY_DIALOGUE_BODY_MS * 2, 'Oi!', 'Corpo');
    expect(typingBody.title).toBe('Oi!');
    expect(typingBody.body).toBe('Cor');
    expect(typingBody.done).toBe(false);
  });

  it('termina quando o corpo acabou', () => {
    const elapsed =
      3 * THERY_DIALOGUE_TITLE_MS + THERY_DIALOGUE_GAP_MS + 5 * THERY_DIALOGUE_BODY_MS;
    const frame = theryDialogueFrame(elapsed, 'Oi!', 'Corpo');
    expect(frame.body).toBe('Corpo');
    expect(frame.done).toBe(true);
  });

  it('trata corpo vazio como concluído após o título', () => {
    const elapsed = 3 * THERY_DIALOGUE_TITLE_MS + THERY_DIALOGUE_GAP_MS;
    const frame = theryDialogueFrame(elapsed, 'Oi!', '');
    expect(frame.title).toBe('Oi!');
    expect(frame.body).toBe('');
    expect(frame.done).toBe(true);
  });
});
