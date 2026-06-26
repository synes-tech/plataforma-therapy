import { isDesktopPdfDelivery } from './pdf-device.utils';

export type PdfDeliveryResult = 'opened' | 'downloaded' | 'shared';

const PREVIEW_REVOKE_MS = 120_000;

function triggerDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function openPdfPreview(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function scheduleRevoke(url: string): void {
  window.setTimeout(() => URL.revokeObjectURL(url), PREVIEW_REVOKE_MS);
}

async function tryNativeShare(
  blob: Blob,
  filename: string,
  shareTitle?: string,
): Promise<PdfDeliveryResult | null> {
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (
    typeof navigator.share !== 'function' ||
    typeof navigator.canShare !== 'function' ||
    !navigator.canShare({ files: [file] })
  ) {
    return null;
  }

  await navigator.share({
    title: shareTitle ?? filename.replace(/\.pdf$/i, ''),
    files: [file],
  });
  return 'shared';
}

/**
 * Entrega o PDF conforme o dispositivo:
 * - Desktop: abre nova aba com visualização + download automático
 * - Mobile: Web Share API (salvar/compartilhar) ou download como fallback
 */
export async function deliverPdfBlob(
  blob: Blob,
  filename: string,
  options?: { shareTitle?: string },
): Promise<PdfDeliveryResult> {
  const url = URL.createObjectURL(blob);

  try {
    if (isDesktopPdfDelivery()) {
      openPdfPreview(url);
      triggerDownload(url, filename);
      scheduleRevoke(url);
      return 'opened';
    }

    const shared = await tryNativeShare(blob, filename, options?.shareTitle);
    if (shared) return shared;

    triggerDownload(url, filename);
    scheduleRevoke(url);
    return 'downloaded';
  } catch (err) {
    URL.revokeObjectURL(url);
    if (err instanceof Error && err.name === 'AbortError') throw err;

    if (isDesktopPdfDelivery()) {
      triggerDownload(url, filename);
      scheduleRevoke(url);
      return 'downloaded';
    }

    throw err;
  }
}

/** @deprecated Prefer deliverPdfBlob — mantido para compatibilidade interna. */
export async function downloadPdfBlob(blob: Blob, filename: string): Promise<PdfDeliveryResult> {
  return deliverPdfBlob(blob, filename);
}
