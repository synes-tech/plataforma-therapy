import { View, StyleSheet, Text } from '@react-pdf/renderer';
import { PDF_COLORS, PDF_FONTS, PDF_PAGE } from './pdf-design-system';
import { formatPdfDateTime, formatProfessionalSignature } from './pdf-content.utils';
import type { PdfExportContext } from './pdf-types';

const styles = StyleSheet.create({
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PDF_PAGE.accentHeight,
    backgroundColor: PDF_COLORS.primary,
  },
  header: {
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  brand: {
    fontSize: 8,
    color: PDF_COLORS.slate,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  exportTag: {
    fontSize: 7,
    color: PDF_COLORS.slateLight,
    textAlign: 'right',
    maxWidth: 160,
  },
  clinicName: {
    fontFamily: PDF_FONTS.bodyBold,
    fontSize: 13,
    color: PDF_COLORS.charcoal,
    marginBottom: 4,
  },
  documentTitle: {
    fontFamily: PDF_FONTS.bodyBold,
    fontSize: 16,
    color: PDF_COLORS.charcoal,
    marginBottom: 4,
  },
  documentSubtitle: {
    fontSize: 9,
    color: PDF_COLORS.charcoalMuted,
  },
  professionalCard: {
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: PDF_COLORS.surface,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: PDF_COLORS.primary,
  },
  professionalLabel: {
    fontSize: 7,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: PDF_COLORS.slate,
    marginBottom: 4,
  },
  professionalName: {
    fontFamily: PDF_FONTS.bodyBold,
    fontSize: 10,
    color: PDF_COLORS.charcoal,
    marginBottom: 2,
  },
  professionalMeta: {
    fontSize: 8,
    color: PDF_COLORS.charcoalMuted,
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: PDF_PAGE.paddingHorizontal,
    right: PDF_PAGE.paddingHorizontal,
    borderTopWidth: 0.5,
    borderTopColor: PDF_COLORS.border,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 7,
    color: PDF_COLORS.slateLight,
  },
  footerSignature: {
    fontSize: 7,
    color: PDF_COLORS.charcoalMuted,
    maxWidth: 240,
    textAlign: 'right',
  },
});

interface PdfDocumentChromeProps {
  context: PdfExportContext;
  documentTitle: string;
  documentSubtitle?: string;
  showProfessionalCard?: boolean;
}

export function PdfDocumentHeader({
  context,
  documentTitle,
  documentSubtitle,
  showProfessionalCard = true,
}: PdfDocumentChromeProps) {
  const professionalDetails = [
    context.professional.crp?.trim(),
    context.professional.specialty?.trim(),
    context.professional.phone?.trim(),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <View style={styles.accentBar} fixed />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Unithery</Text>
          <Text style={styles.exportTag}>
            Exportado em {formatPdfDateTime(context.generatedAt)}
          </Text>
        </View>
        <Text style={styles.clinicName}>{context.clinic.name}</Text>
        <Text style={styles.documentTitle}>{documentTitle}</Text>
        {documentSubtitle ? <Text style={styles.documentSubtitle}>{documentSubtitle}</Text> : null}
      </View>

      {showProfessionalCard ? (
        <View style={styles.professionalCard} wrap={false}>
          <Text style={styles.professionalLabel}>Profissional responsável</Text>
          <Text style={styles.professionalName}>{context.professional.name}</Text>
          {professionalDetails ? (
            <Text style={styles.professionalMeta}>{professionalDetails}</Text>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

export function PdfDocumentFooter({ context }: { context: PdfExportContext }) {
  const signature = formatProfessionalSignature(context.professional);

  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Unithery — documento clínico confidencial</Text>
      <Text
        style={styles.footerSignature}
        render={({ pageNumber, totalPages }) => `${signature} · Pág. ${pageNumber}/${totalPages}`}
      />
    </View>
  );
}

export const pdfStructuredPageStyle = {
  paddingTop: PDF_PAGE.paddingTop,
  paddingBottom: PDF_PAGE.paddingBottom,
  paddingHorizontal: PDF_PAGE.paddingHorizontal,
  fontFamily: PDF_FONTS.body,
  fontSize: 10,
  color: PDF_COLORS.charcoal,
  lineHeight: 1.45,
  backgroundColor: PDF_COLORS.white,
} as const;
