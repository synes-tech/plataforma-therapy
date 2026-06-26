import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { assertFamilyOwnsPatient } from '../_shared/family-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  FamilyClinicalRecordData,
  GetFamilyClinicalRecordPayload,
  GetFamilyClinicalRecordResponse,
} from './types.ts';

interface PatientRow {
  id: string;
  name: string;
  nome_social: string | null;
  birth_date: string | null;
  escolaridade_ocupacao: string | null;
  diagnoses: string[] | null;
  queixa_principal: string | null;
  medicamentos: string | null;
  acompanhamento_multi: string[] | null;
  composicao_familiar: string | null;
  responsaveis: string | null;
  objetivos_terapeuticos: string | null;
  hiperfocos_interesses: string | null;
  informacoes_adicionais: string | null;
}

export async function getFamilyClinicalRecord(
  payload: GetFamilyClinicalRecordPayload,
  caller: AuthenticatedUser,
): Promise<GetFamilyClinicalRecordResponse> {
  const link = await assertFamilyOwnsPatient(caller.id, payload.patient_id);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('patients')
    .select(
      `name, nome_social, birth_date, escolaridade_ocupacao, diagnoses,
       queixa_principal, medicamentos, acompanhamento_multi,
       composicao_familiar, responsaveis, objetivos_terapeuticos,
       hiperfocos_interesses, informacoes_adicionais`,
    )
    .eq('id', link.patient_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new AppError({ code: 'CLINICAL_RECORD_FAILED', message: error.message, statusCode: 500 });
  }

  if (!data) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  const row = data as PatientRow;

  const record: FamilyClinicalRecordData = {
    name: row.name,
    nome_social: row.nome_social,
    birth_date: row.birth_date,
    escolaridade_ocupacao: row.escolaridade_ocupacao,
    diagnoses: row.diagnoses ?? [],
    queixa_principal: row.queixa_principal,
    medicamentos: row.medicamentos,
    acompanhamento_multi: row.acompanhamento_multi ?? [],
    composicao_familiar: row.composicao_familiar,
    responsaveis: row.responsaveis,
    objetivos_terapeuticos: row.objetivos_terapeuticos,
    hiperfocos_interesses: row.hiperfocos_interesses,
    informacoes_adicionais: row.informacoes_adicionais,
  };

  return {
    patient_id: link.patient_id,
    patient_name: link.patient_name,
    record,
  };
}
