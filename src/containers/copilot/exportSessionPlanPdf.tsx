import { PremiumMarkdownPdfDocument } from '@containers/pdf/PremiumMarkdownPdfDocument';
import { deliverPdfBlob, type PdfDeliveryResult } from '@containers/pdf/deliverPdfBlob';
import {
  injectProfessionalPlaceholdersInBlocks,
  markdownToPdfBlocks,
  sanitizeFilename,
} from '@containers/pdf/pdf-content.utils';
import { fetchPdfExportContext } from '@containers/pdf/pdf-context.service';

export interface SessionPlanItem {
  id: string;
  title: string;
  content: string;
}

export function buildSessionPlanMarkdown(items: SessionPlanItem[]): string {
  return items
    .map((item, index) => `## ${index + 1}. ${item.title.trim()}\n\n${item.content.trim()}`)
    .join('\n\n');
}

export async function exportSessionPlanPdf(
  patientId: string,
  patientName: string,
  items: SessionPlanItem[],
): Promise<PdfDeliveryResult> {
  if (items.length === 0) {
    throw new Error('Adicione itens ao plano antes de gerar o PDF.');
  }

  const exportContext = await fetchPdfExportContext(patientId);
  const contentBlocks = injectProfessionalPlaceholdersInBlocks(
    markdownToPdfBlocks(buildSessionPlanMarkdown(items)),
    exportContext.professional,
  );

  const { pdf } = await import('@react-pdf/renderer');
  const date = new Date().toISOString().slice(0, 10);

  const blob = await pdf(
    <PremiumMarkdownPdfDocument
      context={exportContext}
      meta={{
        documentTitle: `Plano de Sessão — ${patientName}`,
        documentSubtitle: 'Sugestões clínicas selecionadas no copiloto',
        metaLine: `${items.length} item(ns) · ${date}`,
        disclaimer:
          'Plano elaborado com apoio de IA e curadoria do profissional. Revise antes de aplicar ou compartilhar com a família.',
      }}
      contentBlocks={contentBlocks}
    />,
  ).toBlob();

  return deliverPdfBlob(blob, `unithery-plano-${sanitizeFilename(patientName)}-${date}.pdf`, {
    shareTitle: `Plano de sessão — ${patientName}`,
  });
}
