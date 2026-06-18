import { sanitizeFilename } from '@features/pdf/pdfUtils';
import {
  buildSessionSummaryBlocks,
  SessionSummaryPdfDocument,
} from './SessionSummaryPdfDocument';
import { formatSessionDate, soapToSummaryMarkdown } from './session-history.utils';
import type { PatientSessionRecord } from './session-history.types';
import { SESSION_STATUS_LABEL } from './session-history.types';

export async function exportSessionSummaryPdf(
  session: PatientSessionRecord,
  patientName: string,
): Promise<void> {
  const markdown = soapToSummaryMarkdown(session.resumo_ia);
  const summaryBlocks = buildSessionSummaryBlocks(markdown);

  const { pdf } = await import('@react-pdf/renderer');

  const payload = {
    patientName,
    sessionDate: formatSessionDate(session.data_sessao),
    statusLabel: SESSION_STATUS_LABEL[session.status_nota] ?? session.status_nota,
    summaryBlocks,
    exportedAt: new Date().toISOString(),
  };

  const blob = await pdf(<SessionSummaryPdfDocument data={payload} />).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = session.data_sessao.slice(0, 10);
  link.href = url;
  link.download = `unithery-sessao-${sanitizeFilename(patientName)}-${date}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
