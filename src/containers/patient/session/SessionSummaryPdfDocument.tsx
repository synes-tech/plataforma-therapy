import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { PdfTextBlock } from '@features/pdf/pdfUtils';
import { markdownToPdfBlocks } from '@features/pdf/pdfUtils';

export interface SessionSummaryPdfPayload {
  patientName: string;
  sessionDate: string;
  statusLabel: string;
  summaryBlocks: PdfTextBlock[];
  exportedAt: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
    lineHeight: 1.5,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 16,
  },
  brand: {
    fontSize: 9,
    color: '#64748b',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  meta: {
    fontSize: 9,
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f766e',
    marginTop: 12,
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 8,
    color: '#334155',
  },
  bullet: {
    marginBottom: 4,
    paddingLeft: 8,
    color: '#334155',
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    fontSize: 8,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export function SessionSummaryPdfDocument({ data }: { data: SessionSummaryPdfPayload }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Unithery</Text>
          <Text style={styles.title}>Resumo da Sessão — {data.patientName}</Text>
          <Text style={styles.meta}>
            {data.sessionDate} · Status: {data.statusLabel}
          </Text>
        </View>

        {data.summaryBlocks.map((block, idx) => {
          if (block.type === 'heading') {
            return (
              <Text key={idx} style={styles.sectionTitle}>
                {block.text}
              </Text>
            );
          }
          if (block.type === 'bullet') {
            return (
              <Text key={idx} style={styles.bullet}>
                • {block.text}
              </Text>
            );
          }
          return (
            <Text key={idx} style={styles.paragraph}>
              {block.text}
            </Text>
          );
        })}

        <Text style={styles.footer}>
          Exportado em {new Date(data.exportedAt).toLocaleString('pt-BR')} · Documento gerado pela Unithery
        </Text>
      </Page>
    </Document>
  );
}

export function buildSessionSummaryBlocks(markdown: string): PdfTextBlock[] {
  return markdownToPdfBlocks(markdown);
}
