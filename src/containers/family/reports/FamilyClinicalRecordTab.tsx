import { useQuery } from '@tanstack/react-query';
import { ListPageSkeleton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { ACOMPANHAMENTO_OPTIONS } from '../../patient/patient-anamnesis.types';
import { ClinicalValue } from '../../patient/ClinicalRecordField';
import { ClinicalFieldsGrid, ClinicalFieldsStack, ClinicalRecordSectionCard } from '../../patient/ClinicalRecordSectionCard';

interface FamilyClinicalRecordResponse {
  patient_id: string;
  patient_name: string;
  record: {
    name: string;
    nome_social: string | null;
    birth_date: string | null;
    escolaridade_ocupacao: string | null;
    diagnoses: string[];
    queixa_principal: string | null;
    medicamentos: string | null;
    acompanhamento_multi: string[];
    composicao_familiar: string | null;
    responsaveis: string | null;
    objetivos_terapeuticos: string | null;
    hiperfocos_interesses: string | null;
    informacoes_adicionais: string | null;
  };
}

function formatBirthDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-charcoal-muted">{label}</p>
      <ClinicalValue value={value ?? ''} multiline />
    </div>
  );
}

export function FamilyClinicalRecordTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['family-clinical-record'],
    queryFn: () => callFunction<FamilyClinicalRecordResponse>('get-family-clinical-record', {}),
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return <ListPageSkeleton rows={4} rowClassName="h-24 rounded-2xl" className="space-y-4" />;
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-error/15 bg-error-light/40 px-4 py-3 text-sm text-error">
        {error instanceof Error ? error.message : 'Erro ao carregar ficha clínica'}
      </div>
    );
  }

  const record = data?.record;
  if (!record) return null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-charcoal-muted">
        Informações cadastrais e clínicas de <span className="font-medium text-charcoal">{data.patient_name}</span>.
        Somente leitura — alterações são feitas pelo terapeuta.
      </p>

      <ClinicalRecordSectionCard title="Identificação" description="Dados básicos do paciente">
        <ClinicalFieldsGrid>
          <Field label="Nome" value={record.name} />
          <Field label="Nome social" value={record.nome_social} />
          <Field label="Data de nascimento" value={formatBirthDate(record.birth_date)} />
          <Field label="Escolaridade / ocupação" value={record.escolaridade_ocupacao} />
        </ClinicalFieldsGrid>
        <div className="mt-4">
          <p className="text-xs font-medium text-charcoal-muted">Diagnósticos</p>
          {record.diagnoses.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {record.diagnoses.map((d) => (
                <span key={d} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {d}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-charcoal-muted/60 italic">Não informado</p>
          )}
        </div>
      </ClinicalRecordSectionCard>

      <ClinicalRecordSectionCard title="Contexto clínico" description="Queixa, medicamentos e acompanhamentos">
        <ClinicalFieldsStack>
          <Field label="Queixa principal" value={record.queixa_principal} />
          <Field label="Medicamentos" value={record.medicamentos} />
        </ClinicalFieldsStack>
        <div className="mt-4">
          <p className="text-xs font-medium text-charcoal-muted">Acompanhamentos</p>
          {record.acompanhamento_multi.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {record.acompanhamento_multi.map((item) => (
                <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-charcoal">
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-charcoal-muted/60 italic">Nenhum selecionado</p>
          )}
          <p className="mt-3 text-[10px] text-charcoal-muted/50">
            Opções: {ACOMPANHAMENTO_OPTIONS.join(', ')}
          </p>
        </div>
      </ClinicalRecordSectionCard>

      <ClinicalRecordSectionCard title="Dinâmica familiar" description="Composição e responsáveis">
        <ClinicalFieldsStack>
          <Field label="Composição familiar" value={record.composicao_familiar} />
          <Field label="Responsáveis" value={record.responsaveis} />
        </ClinicalFieldsStack>
      </ClinicalRecordSectionCard>

      <ClinicalRecordSectionCard title="Parametrização terapêutica" description="Objetivos e interesses">
        <ClinicalFieldsStack>
          <Field label="Objetivos terapêuticos" value={record.objetivos_terapeuticos} />
          <Field label="Hiperfocos e interesses" value={record.hiperfocos_interesses} />
          <Field label="Informações adicionais" value={record.informacoes_adicionais} />
        </ClinicalFieldsStack>
      </ClinicalRecordSectionCard>
    </div>
  );
}
