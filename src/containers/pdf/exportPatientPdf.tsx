import { callFunction } from '@shared/lib/api';
import { deliverPdfBlob, type PdfDeliveryResult } from './deliverPdfBlob';
import { PatientPdfDocument } from './PatientPdfDocument';
import {
  injectProfessionalPlaceholdersInBlocks,
  markdownToPdfBlocks,
  injectProfessionalPlaceholders,
  sanitizeFilename,
} from './pdf-content.utils';
import type { PdfExportContext } from './pdf-types';

interface PdfExportApiResponse {
  found: boolean;
  generated_at?: string;
  professional?: PdfExportContext['professional'];
  clinic?: PdfExportContext['clinic'];
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

export async function exportPatientPdf(patientId: string): Promise<PdfDeliveryResult> {
  const data = await callFunction<PdfExportApiResponse>('get-pdf-data', { patient_id: patientId });

  if (!data.professional || !data.clinic || !data.patient) {
    throw new Error('Dados insuficientes para gerar o PDF.');
  }

  const exportContext: PdfExportContext = {
    professional: data.professional,
    clinic: data.clinic,
    generatedAt: data.generated_at ?? new Date().toISOString(),
  };

  const summaryMarkdown = data.clinical_summary?.markdown ?? '';
  const injectedMarkdown = summaryMarkdown
    ? injectProfessionalPlaceholders(summaryMarkdown, exportContext.professional)
    : '';

  const { pdf } = await import('@react-pdf/renderer');

  const blob = await pdf(
    <PatientPdfDocument
      data={{
        exportContext,
        patient: data.patient,
        clinicalSummaryBlocks: injectedMarkdown
          ? injectProfessionalPlaceholdersInBlocks(
              markdownToPdfBlocks(injectedMarkdown),
              exportContext.professional,
            )
          : [],
        summaryUpdatedAt: data.clinical_summary?.updated_at ?? null,
      }}
    />,
  ).toBlob();

  const date = new Date().toISOString().slice(0, 10);
  return deliverPdfBlob(blob, `unithery-${sanitizeFilename(data.patient.name)}-${date}.pdf`, {
    shareTitle: `Prontuário — ${data.patient.name}`,
  });
}
