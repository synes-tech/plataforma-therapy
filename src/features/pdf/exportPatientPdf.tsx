import { callFunction } from '@shared/lib/api';
import type { PatientPdfPayload } from './PatientPdfDocument';

interface PdfExportApiResponse {
  found: boolean;
  generated_at?: string;
  professional?: PatientPdfPayload['professional'];
  clinic?: PatientPdfPayload['clinic'];
  patient?: {
    name: string;
    birth_date: string;
    gender: string;
    diagnoses: string[];
    clinical_observations: string | null;
  };
  clinical_summary?: {
    markdown: string;
    updated_at: string;
  } | null;
}

/** Carrega @react-pdf/renderer sob demanda (lazy) para não inflar o bundle inicial. */
export async function exportPatientPdf(patientId: string): Promise<void> {
  const data = await callFunction<PdfExportApiResponse>('get-pdf-data', { patient_id: patientId });

  if (!data.professional || !data.clinic || !data.patient) {
    throw new Error('Dados insuficientes para gerar o PDF.');
  }

  const [{ pdf }, { PatientPdfDocument }, { markdownToPdfBlocks, sanitizeFilename }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./PatientPdfDocument'),
    import('./pdfUtils'),
  ]);

  const summaryMarkdown = data.clinical_summary?.markdown ?? '';
  const payload: PatientPdfPayload = {
    professional: data.professional,
    clinic: data.clinic,
    patient: data.patient,
    clinicalSummaryBlocks: summaryMarkdown ? markdownToPdfBlocks(summaryMarkdown) : [],
    summaryUpdatedAt: data.clinical_summary?.updated_at ?? null,
    exportedAt: data.generated_at ?? new Date().toISOString(),
  };

  const blob = await pdf(<PatientPdfDocument data={payload} />).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `unithery-${sanitizeFilename(data.patient.name)}-${date}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
