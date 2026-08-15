import { createServiceClient } from '../_shared/supabase.ts';
import { assertCanAddPatient } from '../_shared/plan-quotas.ts';
import { assertCanCreatePatientPaywall } from '../_shared/paywall.ts';
import { anamnesisToDbRow } from '../_shared/patient-anamnesis-schema.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { contractFromCreatePayload, upsertFinancialContract } from '../_shared/financeiro-contract.ts';
import type { CreatePatientPayload, CreatePatientResponse } from './types.ts';

export async function createPatient(
  payload: CreatePatientPayload,
  caller: AuthenticatedUser,
  _token: string,
): Promise<CreatePatientResponse> {
  const supabase = createServiceClient();

  const { data: professional } = await supabase
    .from('professionals')
    .select('id, clinic_id')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .single();

  if (!professional) {
    throw new AppError({ code: 'NOT_A_PROFESSIONAL', message: 'O usuário não é um profissional registrado.', statusCode: 403 });
  }

  const clinicId = professional.clinic_id;

  await assertCanCreatePatientPaywall(clinicId, professional.id);
  await assertCanAddPatient(clinicId, professional.id);

  const cpf_paciente = payload.possui_cpf_proprio ? payload.cpf_paciente : null;
  const cpf_responsavel = payload.possui_cpf_proprio ? null : payload.cpf_responsavel;
  const nome_responsavel = payload.possui_cpf_proprio ? null : payload.nome_responsavel;

  const anamnesis = anamnesisToDbRow(payload);

  const contactScope = payload.contact_scope ?? null;

  const { data: patient, error } = await supabase
    .from('patients')
    .insert({
      clinic_id: clinicId,
      professional_id: professional.id,
      cpf_paciente,
      cpf_responsavel,
      nome_responsavel,
      name: payload.name,
      birth_date: payload.birth_date,
      gender: payload.gender ?? 'not_informed',
      diagnoses: payload.diagnoses,
      clinical_observations: payload.clinical_observations ?? null,
      ...anamnesis,
      contact_scope: contactScope,
      email_paciente:
        contactScope === 'patient' || contactScope === 'both'
          ? payload.email_paciente ?? null
          : null,
      telefone_paciente:
        contactScope === 'patient' || contactScope === 'both'
          ? payload.telefone_paciente ?? null
          : null,
      email_responsavel:
        contactScope === 'responsible' || contactScope === 'both'
          ? payload.email_responsavel ?? null
          : null,
      telefone_responsavel:
        contactScope === 'responsible' || contactScope === 'both'
          ? payload.telefone_responsavel ?? null
          : null,
      status: 'active',
      status_vinculo: 'ativo',
      created_by: caller.id,
    })
    .select('id')
    .single();

  if (error || !patient) {
    throw new AppError({
      code: 'PATIENT_CREATE_FAILED',
      message: error?.message ?? 'Falha ao criar paciente',
      statusCode: 500,
    });
  }

  let contractResult: Awaited<ReturnType<typeof upsertFinancialContract>>;
  try {
    const input = contractFromCreatePayload(payload as Record<string, unknown>);
    input.patient_id = patient.id;
    contractResult = await upsertFinancialContract({
      clinicId,
      professionalId: professional.id,
      createdBy: caller.id,
      input,
    });
  } catch (err) {
    await supabase
      .from('patients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', patient.id)
      .eq('clinic_id', clinicId);
    throw err;
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: clinicId,
    action: 'patient.create',
    resource_type: 'patient',
    resource_id: patient.id,
    metadata: {
      diagnoses: payload.diagnoses,
      anamnesis_complete: Boolean((payload as Record<string, unknown>).queixa_principal),
      possui_cpf_proprio: payload.possui_cpf_proprio,
      billing_type: contractResult.contract.billing_type ?? null,
      needs_windows: contractResult.needs_windows,
    },
  });

  return {
    patient_id: patient.id,
    message: 'Paciente cadastrado com sucesso',
    contract: contractResult.contract,
    needs_windows: contractResult.needs_windows,
    next_step: contractResult.next_step,
  };
}
