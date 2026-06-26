import { callFunction } from '@shared/lib/api';
import type { PdfExportContext } from './pdf-types';

interface PdfExportApiResponse {
  found: boolean;
  generated_at?: string;
  professional?: PdfExportContext['professional'];
  clinic?: PdfExportContext['clinic'];
}

/** Carrega terapeuta + clínica do usuário logado para exportações PDF. */
export async function fetchPdfExportContext(patientId: string): Promise<PdfExportContext> {
  const data = await callFunction<PdfExportApiResponse>('get-pdf-data', { patient_id: patientId });

  if (!data.professional || !data.clinic) {
    throw new Error('Dados do profissional ou da clínica indisponíveis para exportação.');
  }

  return {
    professional: data.professional,
    clinic: data.clinic,
    generatedAt: data.generated_at ?? new Date().toISOString(),
  };
}
