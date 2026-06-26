import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { PDF_COLORS, PDF_FONTS, PDF_PAGE } from './pdf-design-system';
import { formatPdfDateTime, formatProfessionalSignature } from './pdf-content.utils';
import { PdfContentBlocks } from './PdfContentBlocks';
import type { PdfExportContext, PdfTextBlock, PremiumPdfDocumentMeta } from './pdf-types';

const styles = StyleSheet.create({
  page: {
    paddingTop: PDF_PAGE.paddingTop,
    paddingBottom: PDF_PAGE.paddingBottom,
    paddingHorizontal: PDF_PAGE.paddingHorizontal,
    fontFamily: PDF_FONTS.body,
    fontSize: 10,
    color: PDF_COLORS.charcoal,
    lineHeight: 1.45,
    backgroundColor: PDF_COLORS.white,
  },
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
    marginBottom: 2,
  },
  metaLine: {
    fontSize: 8,
    color: PDF_COLORS.slate,
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
  contentSection: {
    marginTop: 4,
  },
  disclaimer: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: PDF_COLORS.border,
    fontSize: 7,
    color: PDF_COLORS.slateLight,
    fontStyle: 'italic',
    lineHeight: 1.4,
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

export interface PremiumMarkdownPdfDocumentProps {
  context: PdfExportContext;
  meta: PremiumPdfDocumentMeta;
  contentBlocks: PdfTextBlock[];
}

export function PremiumMarkdownPdfDocument({
  context,
  meta,
  contentBlocks,
}: PremiumMarkdownPdfDocumentProps) {
  const signature = formatProfessionalSignature(context.professional);
  const professionalDetails = [
    context.professional.crp?.trim(),
    context.professional.specialty?.trim(),
    context.professional.phone?.trim(),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Document
      title={meta.documentTitle}
      author={context.professional.name}
      subject="Documento clínico Unithery"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.accentBar} fixed />

        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>Unithery</Text>
            <Text style={styles.exportTag}>
              Exportado em {formatPdfDateTime(context.generatedAt)}
            </Text>
          </View>
          <Text style={styles.clinicName}>{context.clinic.name}</Text>
          <Text style={styles.documentTitle}>{meta.documentTitle}</Text>
          {meta.documentSubtitle ? (
            <Text style={styles.documentSubtitle}>{meta.documentSubtitle}</Text>
          ) : null}
          {meta.metaLine ? <Text style={styles.metaLine}>{meta.metaLine}</Text> : null}
        </View>

        <View style={styles.professionalCard} wrap={false}>
          <Text style={styles.professionalLabel}>Profissional responsável</Text>
          <Text style={styles.professionalName}>{context.professional.name}</Text>
          {professionalDetails ? (
            <Text style={styles.professionalMeta}>{professionalDetails}</Text>
          ) : null}
        </View>

        <View style={styles.contentSection}>
          <PdfContentBlocks blocks={contentBlocks} />
        </View>

        {meta.disclaimer ? <Text style={styles.disclaimer}>{meta.disclaimer}</Text> : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Unithery — documento clínico confidencial</Text>
          <Text
            style={styles.footerSignature}
            render={({ pageNumber, totalPages }) =>
              `${signature} · Pág. ${pageNumber}/${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

Font.registerHyphenationCallback((word) => [word]);
