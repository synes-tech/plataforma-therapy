import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { PdfTextBlock } from './pdfUtils';
import { formatGender, formatPhone, calcAge } from './pdfUtils';

export interface PatientPdfPayload {
  professional: {
    name: string;
    email: string;
    phone: string | null;
    specialty: string | null;
    crp: string | null;
  };
  clinic: { name: string };
  patient: {
    name: string;
    birth_date: string;
    gender: string;
    diagnoses: string[];
    clinical_observations: string | null;
  };
  clinicalSummaryBlocks: PdfTextBlock[];
  summaryUpdatedAt: string | null;
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
    lineHeight: 1.45,
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
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: '#475569',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 120,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
  },
  value: {
    flex: 1,
    color: '#1e293b',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 9,
    color: '#334155',
  },
  summaryHeading: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    marginTop: 8,
    marginBottom: 4,
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 12,
    color: '#1a86e2',
  },
  bulletText: {
    flex: 1,
    color: '#334155',
  },
  paragraph: {
    marginBottom: 6,
    color: '#334155',
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#94a3b8',
  },
  disclaimer: {
    fontSize: 7,
    color: '#94a3b8',
    marginTop: 12,
    fontStyle: 'italic',
  },
  emptyNote: {
    color: '#64748b',
    fontStyle: 'italic',
  },
});

function SummaryBlocks({ blocks }: { blocks: PdfTextBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          return (
            <View key={i} wrap={false}>
              <Text style={styles.summaryHeading}>{block.text}</Text>
            </View>
          );
        }
        if (block.type === 'bullet') {
          return (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{block.text}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={styles.paragraph}>
            {block.text}
          </Text>
        );
      })}
    </>
  );
}

export function PatientPdfDocument({ data }: { data: PatientPdfPayload }) {
  const age = calcAge(data.patient.birth_date);
  const diagnoses = data.patient.diagnoses?.length
    ? data.patient.diagnoses
    : ['Não informado'];

  return (
    <Document
      title={`Prontuário — ${data.patient.name}`}
      author={data.professional.name}
      subject="Relatório clínico Unithery"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Unithery — Relatório Clínico</Text>
          <Text style={styles.title}>{data.clinic.name}</Text>
          <Text style={styles.subtitle}>
            Exportado em{' '}
            {new Date(data.exportedAt).toLocaleString('pt-BR', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profissional Responsável</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{data.professional.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Telefone</Text>
            <Text style={styles.value}>{formatPhone(data.professional.phone)}</Text>
          </View>
          {data.professional.specialty && (
            <View style={styles.row}>
              <Text style={styles.label}>Especialidade</Text>
              <Text style={styles.value}>{data.professional.specialty}</Text>
            </View>
          )}
          {data.professional.crp && (
            <View style={styles.row}>
              <Text style={styles.label}>CRP</Text>
              <Text style={styles.value}>{data.professional.crp}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados do Paciente</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{data.patient.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Idade</Text>
            <Text style={styles.value}>{age} anos</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Sexo</Text>
            <Text style={styles.value}>{formatGender(data.patient.gender)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Nascimento</Text>
            <Text style={styles.value}>
              {new Date(data.patient.birth_date).toLocaleDateString('pt-BR')}
            </Text>
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Neurodivergência / Patologias</Text>
          <View style={styles.chipRow}>
            {diagnoses.map((d, i) => (
              <Text key={i} style={styles.chip}>{d}</Text>
            ))}
          </View>
        </View>

        {data.patient.clinical_observations?.trim() && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações Clínicas</Text>
            <Text style={styles.paragraph}>{data.patient.clinical_observations}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo Clínico (IA)</Text>
          {data.summaryUpdatedAt && (
            <Text style={[styles.subtitle, { marginBottom: 8 }]}>
              Atualizado em{' '}
              {new Date(data.summaryUpdatedAt).toLocaleString('pt-BR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          )}
          {data.clinicalSummaryBlocks.length > 0 ? (
            <SummaryBlocks blocks={data.clinicalSummaryBlocks} />
          ) : (
            <Text style={styles.emptyNote}>
              Resumo clínico ainda não gerado. Abra o prontuário e aguarde a geração automática.
            </Text>
          )}
          <Text style={styles.disclaimer}>
            Documento gerado com apoio de IA. Validação e assinatura do profissional são obrigatórias.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Unithery — Uso exclusivo clínico</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

// Helvetica-Bold alias
Font.registerHyphenationCallback((word) => [word]);
