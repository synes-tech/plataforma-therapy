import { describe, expect, it } from 'vitest';
import {
  AUDIO_PLAYBACK_RATES,
  AUDIO_SKIP_SECONDS,
  formatAudioPlaybackRate,
  isAudioPlaybackRate,
  nextAudioPlaybackRate,
  seekTimeFromBar,
  skipAudioTime,
} from './session-audio-player.utils';

describe('player de áudio da sessão', () => {
  it('oferece pulo de 10s e velocidades mais lentas e mais rápidas', () => {
    expect(AUDIO_SKIP_SECONDS).toBe(10);
    expect(AUDIO_PLAYBACK_RATES).toEqual([0.5, 0.75, 1, 1.5, 2]);
  });

  it('avança e retrocede sem sair do intervalo do áudio', () => {
    expect(skipAudioTime(12, 10, 60)).toBe(22);
    expect(skipAudioTime(8, -10, 60)).toBe(0);
    expect(skipAudioTime(55, 10, 60)).toBe(60);
    expect(skipAudioTime(20, 10, 0)).toBe(30);
  });

  it('cicla a velocidade e formata o rótulo', () => {
    expect(nextAudioPlaybackRate(0.5)).toBe(0.75);
    expect(nextAudioPlaybackRate(0.75)).toBe(1);
    expect(nextAudioPlaybackRate(1)).toBe(1.5);
    expect(nextAudioPlaybackRate(1.5)).toBe(2);
    expect(nextAudioPlaybackRate(2)).toBe(0.5);
    expect(nextAudioPlaybackRate(3)).toBe(1);
    expect(isAudioPlaybackRate(0.75)).toBe(true);
    expect(isAudioPlaybackRate(3)).toBe(false);
    expect(formatAudioPlaybackRate(0.5)).toBe('0.5x');
    expect(formatAudioPlaybackRate(0.75)).toBe('0.75x');
    expect(formatAudioPlaybackRate(1)).toBe('1x');
    expect(formatAudioPlaybackRate(1.5)).toBe('1.5x');
    expect(formatAudioPlaybackRate(2)).toBe('2x');
  });

  it('converte o clique na barra no tempo do áudio', () => {
    expect(seekTimeFromBar(50, 0, 100, 60)).toBe(30);
    expect(seekTimeFromBar(-10, 0, 100, 60)).toBe(0);
    expect(seekTimeFromBar(140, 0, 100, 60)).toBe(60);
    expect(seekTimeFromBar(50, 0, 0, 60)).toBe(0);
    expect(seekTimeFromBar(50, 0, 100, 0)).toBe(0);
  });
});
