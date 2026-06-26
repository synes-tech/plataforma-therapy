import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { PatientAnamnesisForm } from '@containers/patient/patient-anamnesis.types';
import { parseDiagnoses } from '@containers/patient/patient-anamnesis.types';
import {
  PdfDocumentFooter,
  PdfDocumentHeader,
  pdfStructuredPageStyle,
} from './PdfDocumentChrome';
import { PdfContentBlocks } from './PdfContentBlocks';
import { PDF_COLORS, PDF_FONTS } from './pdf-design-system';
import { calcAge, formatPhone, markdownToPdfBlocks } from './pdf-content.utils';
import type { PdfExportContext } from './pdf-types';

export interface ClinicalRecordPdfPayload {
  exportContext: PdfExportContext;
  form: PatientAnamnesisForm;
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
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionDesc: {
    fontSize: 8,
    color: PDF_COLORS.slate,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: 140,
    fontFamily: PDF_FONTS.bodyBold,
    color: PDF_COLORS.charcoalMuted,
    fontSize: 9,
  },
  value: {
    flex: 1,
    color: PDF_COLORS.charcoal,
    fontSize: 9,
  },
  multiline: {
    marginBottom: 8,
    color: PDF_COLORS.charcoalMuted,
    fontSize: 9,
    lineHeight: 1.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    backgroundColor: PDF_COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 8,
    color: PDF_COLORS.charcoalMuted,
  },
  emptyNote: {
    color: PDF_COLORS.slate,
    fontStyle: 'italic',
    fontSize: 9,
  },
});

function displayValue(value: string | undefined | null): string {
  const trimmed = value?.trim();
  return trimmed || 'Não informado';
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function MultilineField({ label, value }: { label: string; value: string }) {
  const text = displayValue(value);
  const blocks = text === 'Não informado' ? [] : markdownToPdfBlocks(text);

  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={[styles.label, { width: '100%', marginBottom: 3 }]}>{label}</Text>
      {text === 'Não informado' ? (
        <Text style={styles.emptyNote}>{text}</Text>
      ) : blocks.length > 0 ? (
        <PdfContentBlocks blocks={blocks} />
      ) : (
        <Text style={styles.multiline}>{text}</Text>
      )}
    </View>
  );
}

export function ClinicalRecordPdfDocument({ data }: { data: ClinicalRecordPdfPayload }) {
  const { form } = data;
  const age = form.birth_date ? calcAge(form.birth_date) : null;
  const diagnoses = parseDiagnoses(form.diagnoses);
  const birthLabel = form.birth_date
    ? new Date(`${form.birth_date}T12:00:00`).toLocaleDateString('pt-BR')
    : 'Não informado';

  return (
    <Document
      title={`Ficha Clínica — ${form.name}`}
      author={data.exportContext.professional.name}
      subject="Ficha clínica Unithery"
    >
      <Page size="A4" style={styles.page} wrap>
        <PdfDocumentHeader
          context={data.exportContext}
          documentTitle={`Ficha Clínica — ${form.name || 'Paciente'}`}
          documentSubtitle="Cadastro e parametrização clínica"
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profissional responsável</Text>
          <FieldRow label="Nome" value={data.exportContext.professional.name} />
          <FieldRow label="Telefone" value={formatPhone(data.exportContext.professional.phone)} />
          {data.exportContext.professional.specialty ? (
            <FieldRow label="Especialidade" value={data.exportContext.professional.specialty} />
          ) : null}
          {data.exportContext.professional.crp ? (
            <FieldRow label="CRP" value={data.exportContext.professional.crp} />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados básicos</Text>
          <Text style={styles.sectionDesc}>Identificação e diagnósticos principais</Text>
          <FieldRow label="Nome completo" value={displayValue(form.name)} />
          <FieldRow label="Nome social" value={displayValue(form.nome_social)} />
          <FieldRow
            label="Data de nascimento"
            value={age !== null ? `${birthLabel} (${age} anos)` : birthLabel}
          />
          <FieldRow label="Escolaridade / ocupação" value={displayValue(form.escolaridade_ocupacao)} />
          <View style={{ marginTop: 4 }}>
            <Text style={[styles.label, { width: '100%', marginBottom: 4 }]}>Diagnósticos</Text>
            {diagnoses.length > 0 ? (
              <View style={styles.chipRow}>
                {diagnoses.map((diagnosis, index) => (
                  <Text key={index} style={styles.chip}>
                    {diagnosis}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyNote}>Não informado</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contexto clínico</Text>
          <MultilineField label="Queixa principal" value={form.queixa_principal} />
          <MultilineField label="Medicamentos em uso" value={form.medicamentos} />
          <FieldRow
            label="Acompanhamento multidisciplinar"
            value={
              form.acompanhamento_multi.length
                ? form.acompanhamento_multi.join(' · ')
                : 'Não informado'
            }
          />
          <MultilineField label="Observações clínicas iniciais" value={form.clinical_observations} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dinâmica familiar</Text>
          <MultilineField label="Composição familiar" value={form.composicao_familiar} />
          <MultilineField label="Responsáveis" value={form.responsaveis} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parametrização IA</Text>
          <MultilineField label="Objetivos terapêuticos" value={form.objetivos_terapeuticos} />
          <MultilineField label="Hiperfocos e interesses" value={form.hiperfocos_interesses} />
          <MultilineField label="Informações adicionais" value={form.informacoes_adicionais} />
        </View>

        <PdfDocumentFooter context={data.exportContext} />
      </Page>
    </Document>
  );
}

Font.registerHyphenationCallback((word) => [word]);
