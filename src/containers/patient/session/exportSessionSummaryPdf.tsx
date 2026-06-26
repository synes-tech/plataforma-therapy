import { PremiumMarkdownPdfDocument } from '@containers/pdf/PremiumMarkdownPdfDocument';
import { deliverPdfBlob, type PdfDeliveryResult } from '@containers/pdf/deliverPdfBlob';
import {
  injectProfessionalPlaceholders,
  injectProfessionalPlaceholdersInBlocks,
  markdownToPdfBlocks,
  sanitizeFilename,
} from '@containers/pdf/pdf-content.utils';
import { fetchPdfExportContext } from '@containers/pdf/pdf-context.service';
import { formatSessionDate, soapToSummaryMarkdown } from './session-history.utils';
import type { PatientSessionRecord } from './session-history.types';
import { SESSION_STATUS_LABEL } from './session-history.types';

export async function exportSessionSummaryPdf(
  session: PatientSessionRecord,
  patientName: string,
): Promise<PdfDeliveryResult> {
  const exportContext = await fetchPdfExportContext(session.paciente_id);

  const rawMarkdown = soapToSummaryMarkdown(session.resumo_ia);
  const markdown = injectProfessionalPlaceholders(rawMarkdown, exportContext.professional);
  const contentBlocks = injectProfessionalPlaceholdersInBlocks(
    markdownToPdfBlocks(markdown),
    exportContext.professional,
  );

  const { pdf } = await import('@react-pdf/renderer');

  const blob = await pdf(
    <PremiumMarkdownPdfDocument
      context={exportContext}
      meta={{
        documentTitle: `Relatório de Sessão — ${patientName}`,
        documentSubtitle: 'Orientações clínicas e resumo da sessão',
        metaLine: `${formatSessionDate(session.data_sessao)} · Status: ${
          SESSION_STATUS_LABEL[session.status_nota] ?? session.status_nota
        }`,
        disclaimer:
          'Documento gerado com apoio de IA e validado pelo profissional responsável. Uso clínico confidencial.',
      }}
      contentBlocks={contentBlocks}
    />,
  ).toBlob();

  const date = session.data_sessao.slice(0, 10);
  return deliverPdfBlob(blob, `unithery-sessao-${sanitizeFilename(patientName)}-${date}.pdf`, {
    shareTitle: `Relatório de sessão — ${patientName}`,
  });
}
