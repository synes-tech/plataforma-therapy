/**
 * Desktop/notebook: abrir PDF no navegador + download automático.
 * Mobile (toque): sheet nativo de salvar/compartilhar quando disponível.
 */
export function isDesktopPdfDelivery(): boolean {
  if (typeof window === 'undefined') return true;

  const touchPrimary = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  return !touchPrimary;
}
