import type { PdfDeliveryResult } from './deliverPdfBlob';

export function pdfDeliverySuccessMessage(result: PdfDeliveryResult): string {
  switch (result) {
    case 'opened':
      return 'PDF aberto no navegador e salvo nos downloads';
    case 'shared':
      return 'PDF compartilhado';
    case 'downloaded':
      return 'PDF exportado com sucesso';
  }
}
