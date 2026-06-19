import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { PatientAnamnesisForm } from '@containers/patient/patient-anamnesis.types';
import { parseDiagnoses } from '@containers/patient/patient-anamnesis.types';
import { calcAge, formatPhone } from './pdfUtils';

export interface ClinicalRecordPdfPayload {
  professional: {
    name: string;
    email: string;
    phone: string | null;
    specialty: string | null;
    crp: string | null;
  };
  clinic: { name: string };
  form: PatientAnamnesisForm;
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
  sectionDesc: {
    fontSize: 8,
    color: '#64748b',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: 140,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
  },
  value: {
    flex: 1,
    color: '#1e293b',
  },
  multiline: {
    marginBottom: 8,
    color: '#334155',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  chip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 9,
    color: '#334155',
  },
  emptyNote: {
    color: '#64748b',
    fontStyle: 'italic',
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
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={[styles.label, { width: '100%', marginBottom: 3 }]}>{label}</Text>
      <Text style={text === 'Não informado' ? styles.emptyNote : styles.multiline}>{text}</Text>
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
      author={data.professional.name}
      subject="Ficha clínica Unithery"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Unithery — Ficha Clínica</Text>
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
          <FieldRow label="Nome" value={data.professional.name} />
          <FieldRow label="Telefone" value={formatPhone(data.professional.phone)} />
          {data.professional.specialty && (
            <FieldRow label="Especialidade" value={data.professional.specialty} />
          )}
          {data.professional.crp && <FieldRow label="CRP" value={data.professional.crp} />}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados Básicos</Text>
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
                {diagnoses.map((d, i) => (
                  <Text key={i} style={styles.chip}>
                    {d}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyNote}>Não informado</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contexto Clínico</Text>
          <Text style={styles.sectionDesc}>Queixa, medicação e observações iniciais</Text>
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
          <Text style={styles.sectionTitle}>Dinâmica Familiar</Text>
          <Text style={styles.sectionDesc}>Composição do núcleo e responsáveis legais</Text>
          <MultilineField label="Composição familiar" value={form.composicao_familiar} />
          <MultilineField label="Responsáveis" value={form.responsaveis} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parametrização IA</Text>
          <Text style={styles.sectionDesc}>Contexto para o copiloto e recomendações personalizadas</Text>
          <MultilineField label="Objetivos terapêuticos" value={form.objetivos_terapeuticos} />
          <MultilineField label="Hiperfocos e interesses" value={form.hiperfocos_interesses} />
          <MultilineField label="Informações adicionais" value={form.informacoes_adicionais} />
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

Font.registerHyphenationCallback((word) => [word]);
