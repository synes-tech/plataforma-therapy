import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

export interface ArtifactPdfPayload {
  title: string;
  typeLabel: string;
  dateLabel: string;
  patientName?: string;
  paragraphs: string[];
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
  paragraph: {
    marginBottom: 10,
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

export function ArtifactPdfDocument({ data }: { data: ArtifactPdfPayload }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Unithery</Text>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.meta}>
            {data.typeLabel}
            {data.dateLabel ? ` · ${data.dateLabel}` : ''}
            {data.patientName ? ` · ${data.patientName}` : ''}
          </Text>
        </View>

        {data.paragraphs.map((paragraph, index) => (
          <Text key={index} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        <Text style={styles.footer} fixed>
          Documento gerado pela Unithery · uso clínico confidencial
        </Text>
      </Page>
    </Document>
  );
}
