import { PremiumMarkdownPdfDocument } from '@containers/pdf/PremiumMarkdownPdfDocument';
import { deliverPdfBlob, type PdfDeliveryResult } from '@containers/pdf/deliverPdfBlob';
import {
  injectProfessionalPlaceholders,
  injectProfessionalPlaceholdersInBlocks,
  markdownToPdfBlocks,
  sanitizeFilename,
} from '@containers/pdf/pdf-content.utils';
import { fetchPdfExportContext } from '@containers/pdf/pdf-context.service';
import { ARTIFACT_BADGE_CONFIG } from './patient-artifacts.constants';
import {
  formatArtifactDate,
  resolveArtifactTitle,
} from './patient-artifacts.format';
import type { PatientArtifact } from './patient-artifacts.types';

function buildContentBlocks(artifact: PatientArtifact) {
  return markdownToPdfBlocks(artifact.conteudo_texto);
}

export async function buildArtifactPdfBlob(
  artifact: PatientArtifact,
  patientId: string,
  patientName?: string,
): Promise<Blob> {
  const exportContext = await fetchPdfExportContext(patientId);
  const injectedText = injectProfessionalPlaceholders(artifact.conteudo_texto, exportContext.professional);
  const artifactWithInjection = { ...artifact, conteudo_texto: injectedText };

  const contentBlocks = injectProfessionalPlaceholdersInBlocks(
    buildContentBlocks(artifactWithInjection),
    exportContext.professional,
  );

  const { pdf } = await import('@react-pdf/renderer');

  return pdf(
    <PremiumMarkdownPdfDocument
      context={exportContext}
      meta={{
        documentTitle: resolveArtifactTitle(artifact),
        documentSubtitle: ARTIFACT_BADGE_CONFIG[artifact.tipo_artefato].label,
        metaLine: [
          formatArtifactDate(artifact.criado_em),
          patientName ? `Paciente: ${patientName}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        disclaimer:
          'Conteúdo produzido com apoio de IA sob supervisão clínica. Adapte antes de compartilhar com a família, quando aplicável.',
      }}
      contentBlocks={contentBlocks}
    />,
  ).toBlob();
}

export async function exportArtifactPdf(
  artifact: PatientArtifact,
  patientId: string,
  patientName?: string,
): Promise<PdfDeliveryResult> {
  const blob = await buildArtifactPdfBlob(artifact, patientId, patientName);
  const date = artifact.criado_em.slice(0, 10);
  const title = resolveArtifactTitle(artifact);
  const slug = sanitizeFilename(title);

  return deliverPdfBlob(blob, `unithery-doc-${slug}-${date}.pdf`, { shareTitle: title });
}

export type ExportOrSharePdfResult = PdfDeliveryResult;

/** Entrega PDF conforme dispositivo (preview+download no desktop; share no mobile). */
export async function exportOrShareArtifactPdf(
  artifact: PatientArtifact,
  patientId: string,
  patientName?: string,
): Promise<ExportOrSharePdfResult> {
  return exportArtifactPdf(artifact, patientId, patientName);
}
