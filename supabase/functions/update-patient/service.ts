import { createServiceClient } from '../_shared/supabase.ts';
import { anamnesisPartialToDbRow, type AnamnesisFields } from '../_shared/patient-anamnesis-schema.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { UpdatePatientPayload, UpdatePatientResponse } from './types.ts';

async function verifyPatientWriteAccess(
  supabase: ReturnType<typeof createServiceClient>,
  patientId: string,
  caller: AuthenticatedUser,
): Promise<{ clinic_id: string; professional_id: string }> {
  const { data: patient } = await supabase
    .from('patients')
    .select('id, professional_id, clinic_id')
    .eq('id', patientId)
    .is('deleted_at', null)
    .single();

  if (!patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  if (caller.role === 'professional') {
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', caller.id)
      .eq('id', patient.professional_id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new ForbiddenError('Você não tem acesso a este paciente');
    }
  } else if (caller.role === 'clinic_admin') {
    if (caller.clinic_id !== patient.clinic_id) {
      throw new ForbiddenError('Paciente não pertence à sua clínica');
    }
  }

  return { clinic_id: patient.clinic_id, professional_id: patient.professional_id };
}

const PATIENT_SELECT = `
  id, name, birth_date, gender, diagnoses, clinical_observations, status, created_at, foto_url,
  nome_social, escolaridade_ocupacao, queixa_principal, medicamentos, acompanhamento_multi,
  composicao_familiar, responsaveis, objetivos_terapeuticos, hiperfocos_interesses, informacoes_adicionais
`;

export async function updatePatient(
  payload: UpdatePatientPayload,
  caller: AuthenticatedUser,
): Promise<UpdatePatientResponse> {
  const supabase = createServiceClient();
  const { clinic_id } = await verifyPatientWriteAccess(supabase, payload.patient_id, caller);

  const coreFields: Record<string, unknown> = {};
  if (payload.name !== undefined) coreFields.name = payload.name;
  if (payload.birth_date !== undefined) coreFields.birth_date = payload.birth_date;
  if (payload.gender !== undefined) coreFields.gender = payload.gender;
  if (payload.diagnoses !== undefined) coreFields.diagnoses = payload.diagnoses;
  if (payload.clinical_observations !== undefined) {
    coreFields.clinical_observations = payload.clinical_observations;
  }

  const anamnesisKeys = [
    'nome_social',
    'escolaridade_ocupacao',
    'queixa_principal',
    'medicamentos',
    'acompanhamento_multi',
    'composicao_familiar',
    'responsaveis',
    'objetivos_terapeuticos',
    'hiperfocos_interesses',
    'informacoes_adicionais',
  ] as const;

  const anamnesisPartial: Partial<AnamnesisFields> = {};
  for (const key of anamnesisKeys) {
    if (payload[key] !== undefined) {
      // @ts-expect-error — keys align with payload
      anamnesisPartial[key] = payload[key];
    }
  }

  const updateRow = {
    ...coreFields,
    ...anamnesisPartialToDbRow(anamnesisPartial),
  };

  if (Object.keys(updateRow).length === 0) {
    throw new AppError({
      code: 'NO_FIELDS_TO_UPDATE',
      message: 'Nenhum campo para atualizar',
      statusCode: 400,
    });
  }

  const { error } = await supabase
    .from('patients')
    .update(updateRow)
    .eq('id', payload.patient_id)
    .is('deleted_at', null);

  if (error) {
    throw new AppError({
      code: 'PATIENT_UPDATE_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }

  const { data: freshPatient, error: fetchError } = await supabase
    .from('patients')
    .select(PATIENT_SELECT)
    .eq('id', payload.patient_id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !freshPatient) {
    throw new AppError({
      code: 'PATIENT_FETCH_FAILED',
      message: 'Atualizado, mas falha ao carregar dados frescos',
      statusCode: 500,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id,
    action: 'patient.update',
    resource_type: 'patient',
    resource_id: payload.patient_id,
    metadata: { fields: Object.keys(updateRow) },
  });

  return {
    patient_id: payload.patient_id,
    message: 'Paciente atualizado com sucesso',
    patient: {
      id: freshPatient.id,
      name: freshPatient.name,
      birth_date: freshPatient.birth_date,
      gender: freshPatient.gender,
      diagnoses: freshPatient.diagnoses,
      clinical_observations: freshPatient.clinical_observations,
      status: freshPatient.status,
      created_at: freshPatient.created_at,
      nome_social: freshPatient.nome_social ?? null,
      escolaridade_ocupacao: freshPatient.escolaridade_ocupacao ?? null,
      queixa_principal: freshPatient.queixa_principal ?? null,
      medicamentos: freshPatient.medicamentos ?? null,
      acompanhamento_multi: (freshPatient.acompanhamento_multi as string[] | null) ?? [],
      composicao_familiar: freshPatient.composicao_familiar ?? null,
      responsaveis: freshPatient.responsaveis ?? null,
      objetivos_terapeuticos: freshPatient.objetivos_terapeuticos ?? null,
      hiperfocos_interesses: freshPatient.hiperfocos_interesses ?? null,
      informacoes_adicionais: freshPatient.informacoes_adicionais ?? null,
      foto_url: freshPatient.foto_url ?? null,
    },
  };
}
