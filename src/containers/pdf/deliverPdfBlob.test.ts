import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { deliverPdfBlob } from './deliverPdfBlob';
import * as pdfDevice from './pdf-device.utils';

describe('deliverPdfBlob', () => {
  const blob = new Blob(['pdf'], { type: 'application/pdf' });
  const filename = 'teste.pdf';

  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(window, 'open').mockReturnValue(null);
    vi.spyOn(window, 'setTimeout').mockImplementation((fn) => {
      fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('no desktop abre preview e dispara download', async () => {
    vi.spyOn(pdfDevice, 'isDesktopPdfDelivery').mockReturnValue(true);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

    const result = await deliverPdfBlob(blob, filename);

    expect(result).toBe('opened');
    expect(window.open).toHaveBeenCalledWith('blob:mock', '_blank', 'noopener,noreferrer');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('no mobile tenta share nativo antes do download', async () => {
    vi.spyOn(pdfDevice, 'isDesktopPdfDelivery').mockReturnValue(false);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      share,
      canShare: () => true,
    });

    const result = await deliverPdfBlob(blob, filename, { shareTitle: 'Doc' });

    expect(result).toBe('shared');
    expect(share).toHaveBeenCalled();
  });
});
