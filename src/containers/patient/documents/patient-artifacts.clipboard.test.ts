import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { copyTextToClipboard } from './patient-artifacts.clipboard';

describe('copyTextToClipboard', () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('usa Clipboard API quando disponível', async () => {
    await copyTextToClipboard('Texto do artefato');

    expect(writeText).toHaveBeenCalledWith('Texto do artefato');
  });
});
