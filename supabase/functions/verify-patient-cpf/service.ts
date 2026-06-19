import { createServiceClient } from '../_shared/supabase.ts';
import { isValidCpfFormat, maskPatientName, normalizeCpf } from '../_shared/cpf.ts';
import { matchFieldForPatient } from '../_shared/patient-search.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { VerifyPatientCpfPayload, VerifyPatientCpfResponse } from './types.ts';

const MAX_MATCHES = 20;

export async function verifyPatientCpf(
  payload: VerifyPatientCpfPayload,
  caller: AuthenticatedUser,
): Promise<VerifyPatientCpfResponse> {
  const cpf = normalizeCpf(payload.cpf);

  if (!isValidCpfFormat(cpf)) {
    throw new ValidationError({ cpf: 'CPF inválido' });
  }

  const supabase = createServiceClient();

  if (caller.role === 'professional') {
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new AppError({ code: 'NOT_A_PROFESSIONAL', message: 'Profissional não encontrado', statusCode: 403 });
    }

    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, name, birth_date, status_vinculo, data_desvinculacao, cpf_paciente, cpf_responsavel')
      .eq('professional_id', professional.id)
      .or(`cpf_paciente.eq.${cpf},cpf_responsavel.eq.${cpf}`)
      .is('deleted_at', null)
      .limit(MAX_MATCHES);

    if (error) {
      throw new AppError({ code: 'CPF_LOOKUP_FAILED', message: error.message, statusCode: 500 });
    }

    return mapMatches(patients ?? [], cpf);
  }

  if (caller.role === 'clinic_admin') {
    if (!caller.clinic_id) {
      throw new AppError({ code: 'NO_CLINIC', message: 'Clínica não associada', statusCode: 403 });
    }

    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, name, birth_date, status_vinculo, data_desvinculacao, cpf_paciente, cpf_responsavel')
      .eq('clinic_id', caller.clinic_id)
      .or(`cpf_paciente.eq.${cpf},cpf_responsavel.eq.${cpf}`)
      .is('deleted_at', null)
      .limit(MAX_MATCHES);

    if (error) {
      throw new AppError({ code: 'CPF_LOOKUP_FAILED', message: error.message, statusCode: 500 });
    }

    return mapMatches(patients ?? [], cpf);
  }

  throw new AppError({ code: 'FORBIDDEN', message: 'Perfil sem permissão para verificar CPF', statusCode: 403 });
}

function mapMatches(
  rows: Array<Record<string, unknown>>,
  cpf: string,
): VerifyPatientCpfResponse {
  if (rows.length === 0) return { exists: false, matches: [] };

  return {
    exists: true,
    matches: rows.map((patient) => ({
      patient_id: patient.id as string,
      name_masked: maskPatientName(patient.name as string),
      birth_date: patient.birth_date as string,
      status_vinculo: patient.status_vinculo as 'ativo' | 'desvinculado',
      data_desvinculacao: (patient.data_desvinculacao as string | null) ?? null,
      match_field: matchFieldForPatient(cpf, {
        cpf_paciente: patient.cpf_paciente as string | null,
        cpf_responsavel: patient.cpf_responsavel as string | null,
      }),
    })),
  };
}
