export interface PdfProfessionalContext {
  name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  crp: string | null;
}

export interface PdfClinicContext {
  name: string;
}

export interface PdfExportContext {
  professional: PdfProfessionalContext;
  clinic: PdfClinicContext;
  generatedAt: string;
}

export type PdfTextBlock =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

export interface PremiumPdfDocumentMeta {
  documentTitle: string;
  documentSubtitle?: string;
  metaLine?: string;
  disclaimer?: string;
}
