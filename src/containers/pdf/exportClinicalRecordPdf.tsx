import type { PatientAnamnesisForm } from '@containers/patient/patient-anamnesis.types';
import { fetchPdfExportContext } from './pdf-context.service';
import { ClinicalRecordPdfDocument } from './ClinicalRecordPdfDocument';
import { deliverPdfBlob, type PdfDeliveryResult } from './deliverPdfBlob';
import { sanitizeFilename } from './pdf-content.utils';

export async function exportClinicalRecordPdf(
  patientId: string,
  form: PatientAnamnesisForm,
): Promise<PdfDeliveryResult> {
  const exportContext = await fetchPdfExportContext(patientId);
  const { pdf } = await import('@react-pdf/renderer');

  const blob = await pdf(
    <ClinicalRecordPdfDocument data={{ exportContext, form }} />,
  ).toBlob();

  const date = new Date().toISOString().slice(0, 10);
  const name = form.name.trim() || 'paciente';
  return deliverPdfBlob(blob, `unithery-ficha-${sanitizeFilename(name)}-${date}.pdf`, {
    shareTitle: `Ficha clínica — ${name}`,
  });
}
