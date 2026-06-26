import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { PdfContentBlocks } from '@containers/pdf/PdfContentBlocks';
import {
  PdfDocumentFooter,
  PdfDocumentHeader,
  pdfStructuredPageStyle,
} from '@containers/pdf/PdfDocumentChrome';
import { PDF_COLORS, PDF_FONTS } from '@containers/pdf/pdf-design-system';
import { calcAge, formatGender, formatPhone } from '@containers/pdf/pdf-content.utils';
import type { PdfExportContext, PdfTextBlock } from '@containers/pdf/pdf-types';

export interface PatientPdfPayload {
  exportContext: PdfExportContext;
  patient: {
    name: string;
    birth_date: string;
    gender: string;
    diagnoses: string[];
    clinical_observations: string | null;
  };
  clinicalSummaryBlocks: PdfTextBlock[];
  summaryUpdatedAt: string | null;
}

const styles = StyleSheet.create({
  page: pdfStructuredPageStyle,
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: PDF_FONTS.bodyBold,
    fontSize: 10,
    color: PDF_COLORS.charcoal,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 120,
    fontFamily: PDF_FONTS.bodyBold,
    color: PDF_COLORS.charcoalMuted,
    fontSize: 9,
  },
  value: {
    flex: 1,
    color: PDF_COLORS.charcoal,
    fontSize: 9,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    backgroundColor: PDF_COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 8,
    color: PDF_COLORS.charcoalMuted,
  },
  subtitle: {
    fontSize: 8,
    color: PDF_COLORS.slate,
    marginBottom: 8,
  },
  disclaimer: {
    marginTop: 12,
    fontSize: 7,
    color: PDF_COLORS.slateLight,
    fontStyle: 'italic',
  },
  emptyNote: {
    color: PDF_COLORS.slate,
    fontStyle: 'italic',
    fontSize: 9,
  },
});

export function PatientPdfDocument({ data }: { data: PatientPdfPayload }) {
  const age = calcAge(data.patient.birth_date);
  const diagnoses = data.patient.diagnoses?.length ? data.patient.diagnoses : ['Não informado'];

  return (
    <Document
      title={`Prontuário — ${data.patient.name}`}
      author={data.exportContext.professional.name}
      subject="Relatório clínico Unithery"
    >
      <Page size="A4" style={styles.page} wrap>
        <PdfDocumentHeader
          context={data.exportContext}
          documentTitle={`Prontuário — ${data.patient.name}`}
          documentSubtitle="Resumo clínico consolidado"
          showProfessionalCard={false}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profissional responsável</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome</Text>
            <Text style={styles.value}>{data.exportContext.professional.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Telefone</Text>
            <Text style={styles.value}>{formatPhone(data.exportContext.professional.phone)}</Text>
          </View>
          {data.exportContext.professional.specialty ? (
            <View style={styles.row}>
              <Text style={styles.label}>Especialidade</Text>
              <Text style={styles.value}>{data.exportContext.professional.specialty}</Text>
            </View>
          ) : null}
          {data.exportContext.professional.crp ? (
            <View style={styles.row}>
              <Text style={styles.label}>CRP</Text>
              <Text style={styles.value}>{data.exportContext.professional.crp}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados do paciente</Text>
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
          <Text style={styles.sectionTitle}>Neurodivergência / patologias</Text>
          <View style={styles.chipRow}>
            {diagnoses.map((diagnosis, index) => (
              <Text key={index} style={styles.chip}>
                {diagnosis}
              </Text>
            ))}
          </View>
        </View>

        {data.patient.clinical_observations?.trim() ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações clínicas</Text>
            <Text style={styles.value}>{data.patient.clinical_observations}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo clínico (IA)</Text>
          {data.summaryUpdatedAt ? (
            <Text style={styles.subtitle}>
              Atualizado em{' '}
              {new Date(data.summaryUpdatedAt).toLocaleString('pt-BR', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          ) : null}
          {data.clinicalSummaryBlocks.length > 0 ? (
            <PdfContentBlocks blocks={data.clinicalSummaryBlocks} />
          ) : (
            <Text style={styles.emptyNote}>
              Resumo clínico ainda não gerado. Abra o prontuário e aguarde a geração automática.
            </Text>
          )}
          <Text style={styles.disclaimer}>
            Documento gerado com apoio de IA. Validação e assinatura do profissional são obrigatórias.
          </Text>
        </View>

        <PdfDocumentFooter context={data.exportContext} />
      </Page>
    </Document>
  );
}

Font.registerHyphenationCallback((word) => [word]);
