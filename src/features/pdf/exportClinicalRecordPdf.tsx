import { callFunction } from '@shared/lib/api';
import type { PatientAnamnesisForm } from '@containers/patient/patient-anamnesis.types';
import type { ClinicalRecordPdfPayload } from './ClinicalRecordPdfDocument';

interface PdfMetaResponse {
  found: boolean;
  generated_at?: string;
  professional?: ClinicalRecordPdfPayload['professional'];
  clinic?: ClinicalRecordPdfPayload['clinic'];
}

export async function exportClinicalRecordPdf(
  patientId: string,
  form: PatientAnamnesisForm,
): Promise<void> {
  const meta = await callFunction<PdfMetaResponse>('get-pdf-data', { patient_id: patientId });

  if (!meta.professional || !meta.clinic) {
    throw new Error('Dados insuficientes para gerar o PDF.');
  }

  const [{ pdf }, { ClinicalRecordPdfDocument }, { sanitizeFilename }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./ClinicalRecordPdfDocument'),
    import('./pdfUtils'),
  ]);

  const payload: ClinicalRecordPdfPayload = {
    professional: meta.professional,
    clinic: meta.clinic,
    form,
    exportedAt: meta.generated_at ?? new Date().toISOString(),
  };

  const blob = await pdf(<ClinicalRecordPdfDocument data={payload} />).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  const name = form.name.trim() || 'paciente';
  link.href = url;
  link.download = `unithery-ficha-${sanitizeFilename(name)}-${date}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
