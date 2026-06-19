import { sanitizeFilename } from '@features/pdf/pdfUtils';
import { ARTIFACT_BADGE_CONFIG } from './patient-artifacts.constants';
import {
  buildArtifactTitle,
  formatArtifactDate,
} from './patient-artifacts.format';
import type { PatientArtifact } from './patient-artifacts.types';
import type { ArtifactPdfPayload } from './ArtifactPdfDocument';

function buildPdfPayload(
  artifact: PatientArtifact,
  patientName?: string,
): ArtifactPdfPayload {
  const paragraphs = artifact.conteudo_texto
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    title: buildArtifactTitle(artifact.tipo_artefato, artifact.criado_em),
    typeLabel: ARTIFACT_BADGE_CONFIG[artifact.tipo_artefato].label,
    dateLabel: formatArtifactDate(artifact.criado_em),
    patientName,
    paragraphs: paragraphs.length > 0 ? paragraphs : [artifact.conteudo_texto.trim()],
  };
}

export async function buildArtifactPdfBlob(
  artifact: PatientArtifact,
  patientName?: string,
): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  const { ArtifactPdfDocument } = await import('./ArtifactPdfDocument');
  const payload = buildPdfPayload(artifact, patientName);
  return pdf(<ArtifactPdfDocument data={payload} />).toBlob();
}

export async function exportArtifactPdf(
  artifact: PatientArtifact,
  patientName?: string,
): Promise<void> {
  const blob = await buildArtifactPdfBlob(artifact, patientName);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = artifact.criado_em.slice(0, 10);
  const slug = sanitizeFilename(buildArtifactTitle(artifact.tipo_artefato, artifact.criado_em));
  link.href = url;
  link.download = `unithery-doc-${slug}-${date}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export type ExportOrSharePdfResult = 'shared' | 'downloaded';

/** Compartilha PDF nativamente quando possível; senão faz download. */
export async function exportOrShareArtifactPdf(
  artifact: PatientArtifact,
  patientName?: string,
): Promise<ExportOrSharePdfResult> {
  const blob = await buildArtifactPdfBlob(artifact, patientName);
  const title = buildArtifactTitle(artifact.tipo_artefato, artifact.criado_em);
  const date = artifact.criado_em.slice(0, 10);
  const file = new File([blob], `unithery-documento-${date}.pdf`, { type: 'application/pdf' });

  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ title, files: [file] });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = sanitizeFilename(title);
  link.href = url;
  link.download = `unithery-doc-${slug}-${date}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
